package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/config"
	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/pkg/logger"
	"github.com/moogodev/moogodev/pkg/session"
)

// credStore is a scripted credential store.
type credStore struct {
	byEmail map[string]*dbcontrol.User

	createdUser    *dbcontrol.User
	createErr      error
	resetErr       error
	resetTokenErr  error
	resetTokenHash string
	resetPassword  string

	// Verification-token bookkeeping. tokenHash keeps the last issued hash so
	// a test can confirm that what was stored is the hash of what was mailed,
	// not the raw token.
	verifyTokenHash string
	verifyErr       error
	verifiedErr     error
	markedVerified  uuid.UUID
	markVerifyErr   error
	// verificationTokens maps the raw token a test presents to the account it
	// was issued for, so VerifyEmail can stand in for the real lookup.
	verificationTokens map[string]*dbcontrol.User
}

func (store *credStore) UserByEmail(ctx context.Context, email string) (*dbcontrol.User, error) {
	user, ok := store.byEmail[strings.ToLower(email)]
	if !ok {
		return nil, dbcontrol.ErrNotFound
	}
	return user, nil
}

func (store *credStore) CreateUserWithPassword(
	ctx context.Context, email, name, passwordHash string,
	maxProjects int, maxDBBytes, maxStorageBytes int64,
) (*dbcontrol.User, error) {
	if store.createErr != nil {
		return nil, store.createErr
	}
	if _, taken := store.byEmail[strings.ToLower(email)]; taken {
		return nil, dbcontrol.ErrEmailTaken
	}
	user := &dbcontrol.User{
		ID:           uuid.New(),
		Email:        strings.ToLower(email),
		Name:         name,
		PasswordHash: passwordHash,
	}
	store.byEmail[strings.ToLower(email)] = user
	store.createdUser = user
	return user, nil
}

func (store *credStore) CreatePasswordResetToken(
	ctx context.Context, userID uuid.UUID, tokenHash string, ttl time.Duration,
) error {
	if store.resetTokenErr != nil {
		return store.resetTokenErr
	}
	store.resetTokenHash = tokenHash
	return nil
}

func (store *credStore) ResetPassword(ctx context.Context, tokenHash, newPasswordHash string) error {
	if store.resetErr != nil {
		return store.resetErr
	}
	store.resetPassword = newPasswordHash
	return nil
}

func (store *credStore) CreateVerificationToken(
	ctx context.Context, userID uuid.UUID, tokenHash string, ttl time.Duration,
) error {
	if store.verifyErr != nil {
		return store.verifyErr
	}
	store.verifyTokenHash = tokenHash
	return nil
}

func (store *credStore) VerifyEmail(ctx context.Context, tokenHash string) error {
	if store.verifyErr != nil {
		return store.verifyErr
	}
	for raw, user := range store.verificationTokens {
		if hashResetToken(raw) != tokenHash {
			continue
		}
		stamp := time.Now()
		user.EmailVerifiedAt = &stamp
		return nil
	}
	return dbcontrol.ErrVerificationTokenInvalid
}

// MarkEmailVerified stands in for the production UPDATE ... SET
// email_verified_at = now(), flipping the same field a confirmation token would.
func (store *credStore) MarkEmailVerified(ctx context.Context, userID uuid.UUID) error {
	if store.markVerifyErr != nil {
		return store.markVerifyErr
	}
	store.markedVerified = userID
	for _, user := range store.byEmail {
		if user.ID == userID {
			now := time.Now()
			user.EmailVerifiedAt = &now
			return nil
		}
	}
	return nil
}

func (store *credStore) EmailVerified(ctx context.Context, userID uuid.UUID) (bool, error) {
	if store.verifiedErr != nil {
		return false, store.verifiedErr
	}
	for _, user := range store.byEmail {
		if user.ID == userID {
			return user.EmailVerifiedAt != nil, nil
		}
	}
	return false, dbcontrol.ErrNotFound
}

// credMailer records which transactional mail went out and to whom.
type credMailer struct {
	sentTo  string
	sentErr error

	// disabled stands in for a deployment with no provider configured at all.
	// It is false by default so the ordinary tests keep exercising the
	// send-a-confirmation path.
	disabled bool

	// verificationToken is the raw confirmation token handed to the mailer, so a
	// test can present it back to the verify endpoint exactly as the frontend
	// would after reading it out of the link.
	verificationToken string
	sentVerification  bool
}

// Enabled reports whether a provider is configured, matching mail.Sender.
func (mailer *credMailer) Enabled() bool { return !mailer.disabled }

func (mailer *credMailer) SendPasswordReset(ctx context.Context, to, token string) error {
	// Recorded before the failure so a test can tell "attempted and refused"
	// from "never called".
	mailer.sentTo = to
	if mailer.sentErr != nil {
		return mailer.sentErr
	}
	return nil
}

func (mailer *credMailer) SendEmailVerification(ctx context.Context, to, token string) error {
	if mailer.sentErr != nil {
		return mailer.sentErr
	}
	mailer.sentTo = to
	mailer.verificationToken = token
	mailer.sentVerification = true
	return nil
}

// newCredHandler wires a Credentials handler over the fakes.
func newCredHandler(t *testing.T, store *credStore, mailer *credMailer) *Credentials {
	return newCredHandlerIn(t, store, mailer, "development")
}

// newCredHandlerIn wires a handler with an explicit environment, so the
// production branch of the no-provider path is reachable from a test.
func newCredHandlerIn(t *testing.T, store *credStore, mailer *credMailer, environment string) *Credentials {
	t.Helper()
	signer, err := session.NewSigner("a-test-secret-that-is-definitely-long-enough", time.Hour)
	if err != nil {
		t.Fatalf("new signer: %v", err)
	}
	sessions := auth.NewSessionManager(signer, false)
	cfg := config.Config{
		Environment:            environment,
		DefaultMaxProjects:     5,
		DefaultMaxDBBytes:      100 * 1024 * 1024,
		DefaultMaxStorageBytes: 256 * 1024 * 1024,
		PasswordResetTTL:       time.Hour,
		VerificationTTL:        24 * time.Hour,
	}
	return NewCredentials(store, sessions, mailer, cfg, logger.Nop())
}

// doJSON invokes a single credential handler method with a JSON body.
func doJSON(t *testing.T, handle func(http.ResponseWriter, *http.Request), method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	handle(recorder, request)
	return recorder
}

// A credential endpoint must refuse a body that is not declared as JSON: an
// HTML form cannot set application/json, so the check is what stops one from
// driving sign-in; see httpx.RequireJSON.
func TestLoginRefusesBodyNotDeclaredAsJSON(t *testing.T) {
	store := &credStore{byEmail: map[string]*dbcontrol.User{}}
	mailer := &credMailer{}
	handler := newCredHandler(t, store, mailer)

	request := httptest.NewRequest(http.MethodPost, "/auth/login",
		strings.NewReader(`{"email":"a@example.com","password":"hunter2"}`))
	request.Header.Set("Content-Type", "text/plain")
	recorder := httptest.NewRecorder()
	handler.Login(recorder, request)

	if recorder.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, want 415", recorder.Code)
	}
}

func TestRegisterCreatesAccountAndSendsConfirmation(t *testing.T) {
	store := &credStore{byEmail: map[string]*dbcontrol.User{}}
	mailer := &credMailer{}
	handler := newCredHandler(t, store, mailer)

	recorder := doJSON(t, handler.Register, http.MethodPost, "/auth/register",
		`{"email":"New@Example.com","name":"New","password":"supersecret1"}`)

	if recorder.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if store.createdUser == nil {
		t.Fatal("expected a user to be created")
	}
	if store.createdUser.Email != "new@example.com" {
		t.Errorf("expected email normalized to lowercase, got %q", store.createdUser.Email)
	}
	if store.createdUser.PasswordHash == "" {
		t.Error("expected a password hash to be stored")
	}

	// The account must not be usable yet, and must not be handed a session.
	// Issuing one here would mean a signed-in visitor whose address has been
	// proven by nobody.
	if store.createdUser.EmailVerifiedAt != nil {
		t.Error("expected a new account to start unverified")
	}
	if hasSessionCookie(recorder) {
		t.Error("expected no session cookie on register")
	}

	// A confirmation link has to have gone out, and the stored value must be a
	// hash of it rather than the token itself.
	if !mailer.sentVerification {
		t.Fatal("expected a confirmation email to be sent")
	}
	if mailer.verificationToken == "" {
		t.Error("expected a token to be handed to the mailer")
	}
	if store.verifyTokenHash == mailer.verificationToken {
		t.Error("expected the raw token not to be stored")
	}
	if store.verifyTokenHash != hashResetToken(mailer.verificationToken) {
		t.Error("expected the stored value to be the hash of the mailed token")
	}
}

func TestRegisterReportsAFailedConfirmationEmail(t *testing.T) {
	store := &credStore{byEmail: map[string]*dbcontrol.User{}}
	// The token write succeeds, the delivery does not.
	mailer := &credMailer{sentErr: errors.New("resend returned status 422")}
	handler := newCredHandler(t, store, mailer)

	recorder := doJSON(t, handler.Register, http.MethodPost, "/auth/register",
		`{"email":"undeliverable@example.com","password":"supersecret1"}`)

	// The account exists and cannot be used, so reporting success here would
	// leave somebody waiting on an email that will never arrive.
	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "mail_failed") {
		t.Errorf("expected the mail_failed code, got %s", recorder.Body.String())
	}
	if store.createdUser == nil {
		t.Error("expected the account to still have been created")
	}
}

func TestVerifyEmailAcceptsAMailedTokenAndUnblocksLogin(t *testing.T) {
	store := &credStore{byEmail: map[string]*dbcontrol.User{}}
	mailer := &credMailer{}
	handler := newCredHandler(t, store, mailer)

	doJSON(t, handler.Register, http.MethodPost, "/auth/register",
		`{"email":"ketut@example.com","password":"supersecret1"}`)

	// Before confirmation, login is refused with a reason the password holder
	// can act on.
	before := doJSON(t, handler.Login, http.MethodPost, "/auth/login",
		`{"email":"ketut@example.com","password":"supersecret1"}`)
	if before.Code != http.StatusForbidden {
		t.Fatalf("expected 403 before verifying, got %d: %s", before.Code, before.Body.String())
	}
	if !strings.Contains(before.Body.String(), "email_not_verified") {
		t.Errorf("expected the email_not_verified code, got %s", before.Body.String())
	}

	// Present the token exactly as the frontend would after reading the link.
	store.verificationTokens = map[string]*dbcontrol.User{
		mailer.verificationToken: store.createdUser,
	}
	body, err := json.Marshal(map[string]string{"token": mailer.verificationToken})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	verified := doJSON(t, handler.VerifyEmail, http.MethodPost, "/auth/verify-email", string(body))
	if verified.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", verified.Code, verified.Body.String())
	}

	after := doJSON(t, handler.Login, http.MethodPost, "/auth/login",
		`{"email":"ketut@example.com","password":"supersecret1"}`)
	if after.Code != http.StatusOK {
		t.Fatalf("expected 200 after verifying, got %d: %s", after.Code, after.Body.String())
	}
	if !hasSessionCookie(after) {
		t.Error("expected a session cookie once verified")
	}
}

func TestVerifyEmailRejectsABadToken(t *testing.T) {
	store := &credStore{byEmail: map[string]*dbcontrol.User{}}
	handler := newCredHandler(t, store, &credMailer{})

	recorder := doJSON(t, handler.VerifyEmail, http.MethodPost, "/auth/verify-email",
		`{"token":"never-issued"}`)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", recorder.Code, recorder.Body.String())
	}

	empty := doJSON(t, handler.VerifyEmail, http.MethodPost, "/auth/verify-email", `{"token":"  "}`)
	if empty.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for a blank token, got %d", empty.Code)
	}
}

func TestResendVerificationAnswersIdenticallyForEveryCase(t *testing.T) {
	pending := &dbcontrol.User{ID: uuid.New(), Email: "pending@example.com"}
	verifiedAt := time.Now()
	already := &dbcontrol.User{
		ID: uuid.New(), Email: "done@example.com", EmailVerifiedAt: &verifiedAt,
	}
	store := &credStore{
		byEmail: map[string]*dbcontrol.User{
			"pending@example.com": pending,
			"done@example.com":    already,
		},
	}
	mailer := &credMailer{}
	handler := newCredHandler(t, store, mailer)

	const body = `{"email":`
	responses := make([]string, 0, 4)

	for _, email := range []string{
		"pending@example.com", // needs a link
		"done@example.com",    // already verified
		"nobody@example.com",  // no such account
		"not-an-email",        // malformed
	} {
		recorder := doJSON(t, handler.ResendVerification, http.MethodPost,
			"/auth/resend-verification", body+`"`+email+`"}`)
		if recorder.Code != http.StatusOK {
			t.Fatalf("expected 200 for %s, got %d", email, recorder.Code)
		}
		responses = append(responses, recorder.Body.String())
	}

	// Differing responses here would turn this endpoint into an oracle for
	// which addresses are registered and which are already confirmed.
	for index, response := range responses {
		if response != responses[0] {
			t.Errorf("response %d differs from the first: %q vs %q", index, response, responses[0])
		}
	}
}

// Register must not say whether an address already has an account.
//
// It used to answer 409 email_taken, which made this the one endpoint in the
// set that could be used to enumerate registered addresses while login,
// forgot-password and resend-verification all answered identically on purpose.
// The taken branch now returns the same 202 and the same body as a fresh
// registration, so the test compares the two responses directly rather than
// asserting a status.
func TestRegisterDoesNotRevealThatAnEmailIsTaken(t *testing.T) {
	taken := &dbcontrol.User{ID: uuid.New(), Email: "taken@example.com"}
	store := &credStore{byEmail: map[string]*dbcontrol.User{"taken@example.com": taken}}
	handler := newCredHandler(t, store, &credMailer{})

	alreadyRegistered := doJSON(t, handler.Register, http.MethodPost, "/auth/register",
		`{"email":"taken@example.com","password":"supersecret1"}`)

	// A second store, so the fresh address genuinely does not exist yet and the
	// comparison is between the two branches rather than between two calls that
	// happen to hit the same one.
	fresh := &credStore{byEmail: map[string]*dbcontrol.User{}}
	freshHandler := newCredHandler(t, fresh, &credMailer{})

	justCreated := doJSON(t, freshHandler.Register, http.MethodPost, "/auth/register",
		`{"email":"fresh@example.com","password":"supersecret1"}`)

	if alreadyRegistered.Code != http.StatusAccepted {
		t.Fatalf("expected 202 for an address that exists, got %d: %s",
			alreadyRegistered.Code, alreadyRegistered.Body.String())
	}
	if alreadyRegistered.Code != justCreated.Code {
		t.Errorf("status differs: taken is %d, created is %d",
			alreadyRegistered.Code, justCreated.Code)
	}

	// The email is echoed because the form shows which inbox the link went to,
	// and it is the address the caller just typed. Everything else has to match.
	if got, want := alreadyRegistered.Body.String(), justCreated.Body.String(); got != want {
		var taken, created registeredResponse
		if err := json.Unmarshal([]byte(got), &taken); err != nil {
			t.Fatalf("decode taken response: %v", err)
		}
		if err := json.Unmarshal([]byte(want), &created); err != nil {
			t.Fatalf("decode created response: %v", err)
		}
		if taken.Message != created.Message {
			t.Errorf("message differs: %q vs %q", taken.Message, created.Message)
		}
	}
}

// A taken address must not trigger a second confirmation email either: that
// would be both a mail-cost loop and a hint that the account exists.
func TestRegisterDoesNotSendMailForATakenAddress(t *testing.T) {
	taken := &dbcontrol.User{ID: uuid.New(), Email: "taken@example.com"}
	store := &credStore{byEmail: map[string]*dbcontrol.User{"taken@example.com": taken}}
	mailer := &credMailer{}
	handler := newCredHandler(t, store, mailer)

	doJSON(t, handler.Register, http.MethodPost, "/auth/register",
		`{"email":"taken@example.com","password":"supersecret1"}`)

	if mailer.sentVerification {
		t.Error("expected no confirmation mail for an address that already exists")
	}
}

func TestRegisterRejectsInvalidEmailAndShortPassword(t *testing.T) {
	store := &credStore{byEmail: map[string]*dbcontrol.User{}}
	handler := newCredHandler(t, store, &credMailer{})

	if recorder := doJSON(t, handler.Register, http.MethodPost, "/auth/register",
		`{"email":"not-an-email","password":"supersecret1"}`); recorder.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for bad email, got %d", recorder.Code)
	}
	if recorder := doJSON(t, handler.Register, http.MethodPost, "/auth/register",
		`{"email":"a@example.com","password":"short"}`); recorder.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for short password, got %d", recorder.Code)
	}
}

func TestLoginSuccessSetsSession(t *testing.T) {
	hash, err := auth.HashPassword("correcthorse")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	verifiedAt := time.Now()
	store := &credStore{byEmail: map[string]*dbcontrol.User{
		"ketut@example.com": {
			ID: uuid.New(), Email: "ketut@example.com",
			PasswordHash: hash, EmailVerifiedAt: &verifiedAt,
		},
	}}
	handler := newCredHandler(t, store, &credMailer{})

	recorder := doJSON(t, handler.Login, http.MethodPost, "/auth/login",
		`{"email":"ketut@example.com","password":"correcthorse"}`)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !hasSessionCookie(recorder) {
		t.Error("expected a session cookie on login")
	}
}

func TestLoginRefusesAnUnverifiedAccountWithAWrongPassword(t *testing.T) {
	hash, err := auth.HashPassword("correcthorse")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	store := &credStore{byEmail: map[string]*dbcontrol.User{
		// Unverified, and the password is wrong.
		"ketut@example.com": {ID: uuid.New(), Email: "ketut@example.com", PasswordHash: hash},
	}}
	handler := newCredHandler(t, store, &credMailer{})

	recorder := doJSON(t, handler.Login, http.MethodPost, "/auth/login",
		`{"email":"ketut@example.com","password":"wrong"}`)

	// The password is checked first, so this stays a plain credentials failure.
	// Reporting email_not_verified before the password is right would confirm
	// that an address is registered to somebody who only guessed an email.
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if strings.Contains(recorder.Body.String(), "email_not_verified") {
		t.Error("expected the verification state to stay hidden until the password is right")
	}
}

func TestLoginRejectsWrongPasswordAndUnknownEmail(t *testing.T) {
	hash, err := auth.HashPassword("correcthorse")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	store := &credStore{byEmail: map[string]*dbcontrol.User{
		"ketut@example.com": {ID: uuid.New(), Email: "ketut@example.com", PasswordHash: hash},
	}}
	handler := newCredHandler(t, store, &credMailer{})

	// Wrong password.
	if recorder := doJSON(t, handler.Login, http.MethodPost, "/auth/login",
		`{"email":"ketut@example.com","password":"wrong"}`); recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for wrong password, got %d", recorder.Code)
	}
	// Unknown email — must be the same status, not a different one.
	if recorder := doJSON(t, handler.Login, http.MethodPost, "/auth/login",
		`{"email":"ghost@example.com","password":"correcthorse"}`); recorder.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for unknown email, got %d", recorder.Code)
	}
}

func TestForgotPasswordNeverRevealsAccountExistence(t *testing.T) {
	store := &credStore{byEmail: map[string]*dbcontrol.User{}}
	mailer := &credMailer{}
	handler := newCredHandler(t, store, mailer)

	// Unknown email: 200, no mail sent.
	recorder := doJSON(t, handler.ForgotPassword, http.MethodPost, "/auth/forgot-password",
		`{"email":"ghost@example.com"}`)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 for unknown email, got %d", recorder.Code)
	}
	if mailer.sentTo != "" {
		t.Errorf("expected no mail for unknown email, got %q", mailer.sentTo)
	}

	// Known email: 200, mail sent, token stored.
	known := &dbcontrol.User{ID: uuid.New(), Email: "ketut@example.com"}
	store.byEmail["ketut@example.com"] = known
	recorder = doJSON(t, handler.ForgotPassword, http.MethodPost, "/auth/forgot-password",
		`{"email":"ketut@example.com"}`)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 for known email, got %d", recorder.Code)
	}
	if mailer.sentTo != "ketut@example.com" {
		t.Errorf("expected mail to ketut, got %q", mailer.sentTo)
	}
	if store.resetTokenHash == "" {
		t.Error("expected a reset token to be stored")
	}
}

func TestForgotPasswordSwallowsMailFailure(t *testing.T) {
	// A 500 here can only come from an address that exists -- the unknown
	// branch never tries to send -- so reporting the failure would turn the
	// endpoint into a registration oracle for as long as delivery is broken,
	// exactly what the test above promises not to do. The answer has to be
	// byte-identical to the unknown-email case.
	unknownStore := &credStore{byEmail: map[string]*dbcontrol.User{}}
	unknownHandler := newCredHandler(t, unknownStore, &credMailer{})
	unknown := doJSON(t, unknownHandler.ForgotPassword, http.MethodPost, "/auth/forgot-password",
		`{"email":"ghost@example.com"}`)

	known := &dbcontrol.User{ID: uuid.New(), Email: "ketut@example.com"}
	store := &credStore{byEmail: map[string]*dbcontrol.User{"ketut@example.com": known}}
	mailer := &credMailer{sentErr: errors.New("resend down")}
	handler := newCredHandler(t, store, mailer)

	recorder := doJSON(t, handler.ForgotPassword, http.MethodPost, "/auth/forgot-password",
		`{"email":"ketut@example.com"}`)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 when mail fails, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if recorder.Body.String() != unknown.Body.String() {
		t.Errorf("mail failure changed the answer: got %s, want %s",
			recorder.Body.String(), unknown.Body.String())
	}
	if mailer.sentTo != "ketut@example.com" {
		t.Errorf("expected the delivery to be attempted anyway, sentTo = %q", mailer.sentTo)
	}
}

func TestResetPasswordUpdatesAndConsumes(t *testing.T) {
	store := &credStore{byEmail: map[string]*dbcontrol.User{}}
	handler := newCredHandler(t, store, &credMailer{})

	// The raw token the user would have in the link.
	recorder := doJSON(t, handler.ResetPassword, http.MethodPost, "/auth/reset-password",
		`{"token":"sometoken","password":"brandnewpass1"}`)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if store.resetPassword == "" {
		t.Error("expected the new password hash to be set")
	}
}

func TestResetPasswordRejectsInvalidToken(t *testing.T) {
	store := &credStore{byEmail: map[string]*dbcontrol.User{}}
	store.resetErr = dbcontrol.ErrResetTokenInvalid
	handler := newCredHandler(t, store, &credMailer{})

	recorder := doJSON(t, handler.ResetPassword, http.MethodPost, "/auth/reset-password",
		`{"token":"expired","password":"brandnewpass1"}`)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for an invalid token, got %d", recorder.Code)
	}
}

func TestResetPasswordRejectsShortPassword(t *testing.T) {
	store := &credStore{byEmail: map[string]*dbcontrol.User{}}
	handler := newCredHandler(t, store, &credMailer{})

	recorder := doJSON(t, handler.ResetPassword, http.MethodPost, "/auth/reset-password",
		`{"token":"sometoken","password":"short"}`)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for a short password, got %d", recorder.Code)
	}
}

// hasSessionCookie reports whether the response set the session cookie.
func hasSessionCookie(recorder *httptest.ResponseRecorder) bool {
	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name == auth.SessionCookieName && cookie.Value != "" {
			return true
		}
	}
	return false
}

// A deployment with no mail provider used to register the account, fail to
// send, and answer 500 -- leaving a row with email_verified_at NULL that
// Login refuses with nothing to unblock it. In development the account is now
// usable immediately instead.
func TestRegisterWithoutAPrividerProducesAnAccountYouCanOpen(t *testing.T) {
	store := &credStore{byEmail: map[string]*dbcontrol.User{}}
	mailer := &credMailer{disabled: true}
	handler := newCredHandler(t, store, mailer)

	recorder := doJSON(t, handler.Register, http.MethodPost, "/auth/register",
		`{"email":"dev@example.com","password":"correct-horse-battery-staple"}`)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d (%s)", recorder.Code, recorder.Body.String())
	}
	if mailer.sentVerification {
		t.Error("a confirmation was sent through a provider that does not exist")
	}
	if strings.Contains(recorder.Body.String(), "Check your email") {
		t.Errorf("promised an email that cannot be sent: %s", recorder.Body.String())
	}

	// The point of the whole change: the account must now pass the same check
	// that a mailed confirmation token would have satisfied.
	verified, err := store.EmailVerified(context.Background(), store.createdUser.ID)
	if err != nil {
		t.Fatalf("check verification: %v", err)
	}
	if !verified {
		t.Error("the account cannot sign in, which is the bug this replaces")
	}
}

// Configuration refuses to boot a production deployment with no sign-in path at
// all. Reaching this branch means Google is configured and mail is not, so the
// honest answer is to send the person to Google rather than promise an email.
func TestRegisterWithoutAPrividerInProductionPointsAtGoogle(t *testing.T) {
	store := &credStore{byEmail: map[string]*dbcontrol.User{}}
	mailer := &credMailer{disabled: true}
	handler := newCredHandlerIn(t, store, mailer, "production")

	recorder := doJSON(t, handler.Register, http.MethodPost, "/auth/register",
		`{"email":"prod@example.com","password":"correct-horse-battery-staple"}`)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d (%s)", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "sign_in_unavailable") &&
		!strings.Contains(recorder.Body.String(), "email_unavailable") {
		t.Errorf("expected the unavailable code, got %s", recorder.Body.String())
	}
}

// With a provider configured nothing changed: the account waits for a link.
func TestRegisterWithAPrividerStillSendsTheConfirmation(t *testing.T) {
	store := &credStore{byEmail: map[string]*dbcontrol.User{}}
	mailer := &credMailer{}
	handler := newCredHandler(t, store, mailer)

	recorder := doJSON(t, handler.Register, http.MethodPost, "/auth/register",
		`{"email":"real@example.com","password":"correct-horse-battery-staple"}`)

	if recorder.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d (%s)", recorder.Code, recorder.Body.String())
	}
	if !mailer.sentVerification {
		t.Error("no confirmation was sent")
	}
	verified, _ := store.EmailVerified(context.Background(), store.createdUser.ID)
	if verified {
		t.Error("the account was marked verified without a mailed token")
	}
}
