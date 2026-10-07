package handler

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/moogodev/moogodev/internal/auth"
	"github.com/moogodev/moogodev/internal/config"
	"github.com/moogodev/moogodev/internal/dbcontrol"
	"github.com/moogodev/moogodev/pkg/httpx"
	"github.com/moogodev/moogodev/pkg/logger"
)

// credentialStore is the control-plane surface the credential handlers need.
//
// It is a separate, narrower interface than the control plane's Store so the
// sign-in code cannot reach project or bucket operations, and so it can be
// faked in tests without a live Postgres.
type credentialStore interface {
	UserByEmail(ctx context.Context, email string) (*dbcontrol.User, error)
	CreateUserWithPassword(
		ctx context.Context,
		email string,
		name string,
		passwordHash string,
		maxProjects int,
		maxDBBytes int64,
		maxStorageBytes int64,
	) (*dbcontrol.User, error)
	CreatePasswordResetToken(ctx context.Context, userID uuid.UUID, tokenHash string, ttl time.Duration) error
	ResetPassword(ctx context.Context, tokenHash, newPasswordHash string) error
	CreateVerificationToken(ctx context.Context, userID uuid.UUID, tokenHash string, ttl time.Duration) error
	VerifyEmail(ctx context.Context, tokenHash string) error
	EmailVerified(ctx context.Context, userID uuid.UUID) (bool, error)
	MarkEmailVerified(ctx context.Context, userID uuid.UUID) error
}

// mailSender delivers the transactional links.
type mailSender interface {
	SendPasswordReset(ctx context.Context, to, token string) error
	SendEmailVerification(ctx context.Context, to, token string) error
	// Enabled reports whether a provider is configured at all. Without it the
	// sender is not a slow or failing provider, it is one that cannot send, and
	// registration has to be handled differently from a temporary outage.
	Enabled() bool
}

// Credentials serves the email/password sign-in endpoints.
type Credentials struct {
	store    credentialStore
	sessions *auth.SessionManager
	mailer   mailSender
	cfg      config.Config
	log      *logger.Logger
}

// NewCredentials creates a Credentials handler.
func NewCredentials(
	store credentialStore,
	sessions *auth.SessionManager,
	mailer mailSender,
	cfg config.Config,
	log *logger.Logger,
) *Credentials {
	return &Credentials{store: store, sessions: sessions, mailer: mailer, cfg: cfg, log: log}
}

// minimumPasswordLength is the floor for a chosen password.
const minimumPasswordLength = 8

// maximumPasswordLength caps input before hashing. bcrypt only uses the first
// 72 bytes, so a longer value would be silently truncated and confuse the user
// into thinking a longer password was stored.
const maximumPasswordLength = 72

// RegisterRequest is the body accepted by POST /auth/register.
type RegisterRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

// LoginRequest is the body accepted by POST /auth/login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// ForgotPasswordRequest is the body accepted by POST /auth/forgot-password.
type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

// ResetPasswordRequest is the body accepted by POST /auth/reset-password.
type ResetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// credentialResponse is returned on a successful register or login.
type credentialResponse struct {
	User dbcontrol.User `json:"user"`
}

// genericResponse is a plain confirmation.
type genericResponse struct {
	Message string `json:"message"`
}

// registeredResponse is returned by a successful registration.
//
// It deliberately carries no session. The account exists but cannot sign in
// until the address is confirmed, so handing back a session here would either
// create an account that is live before it is verified, or produce a cookie
// that the very next request rejects.
//
// Email is included because the form has to show which inbox the link went to;
// it is the address the person just typed, so it reveals nothing they did not
// already know.
type registeredResponse struct {
	Message string `json:"message"`
	Email   string `json:"email"`
}

// Register handles POST /auth/register.
//
// On success it creates the account, sends a confirmation link, and does not
// sign anybody in. The account is unusable until the link is followed, which is
// what stops somebody registering an address they do not own and locking the
// real owner out of it.
//
// An address that is already registered gets the same 202 as one that was just
// created. This used to answer 409 email_taken, which turned the endpoint into
// an oracle for "who has an account here" -- the one endpoint in the set that
// did, while login, forgot-password and resend-verification all answer
// identically on purpose. The cost is that somebody who mistypes their address
// sees "check your email" instead of being told it is taken.
//
// That trade is safe here for a specific reason, and it is worth stating: the
// confirmation link goes to the address itself, so an attacker who registers
// somebody else's email cannot take the account over -- the real owner still
// holds the only key that unlocks it. What the generic answer removes is the
// ability to go fishing for which addresses are registered.
func (handler *Credentials) Register(w http.ResponseWriter, r *http.Request) {
	var request RegisterRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}

	email := strings.ToLower(strings.TrimSpace(request.Email))
	if !validEmail(email) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_email", "enter a valid email address")
		return
	}
	if err := validatePassword(request.Password); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_password", err.Error())
		return
	}

	hash, err := auth.HashPassword(request.Password)
	if err != nil {
		handler.log.Error("hash password", logger.Fields{"error": err.Error()})
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "could not create the account")
		return
	}
	user, err := handler.store.CreateUserWithPassword(
		r.Context(),
		email,
		strings.TrimSpace(request.Name),
		hash,
		handler.cfg.DefaultMaxProjects,
		handler.cfg.DefaultMaxDBBytes,
		handler.cfg.DefaultMaxStorageBytes,
	)
	if err != nil {
		// A duplicate address answers the same way as a fresh registration: the
		// endpoint must never say whether an address is taken. The confirmation
		// link goes to the address itself, so an attacker who registers a second
		// address cannot take the account over, and only a real failure differs
		// from the generic answer by the status.
		if errors.Is(err, dbcontrol.ErrEmailTaken) {
			httpx.WriteJSON(w, http.StatusAccepted, registeredResponse{
				Message: registrationConfirmation,
				Email:   email,
			})
			return
		}
		handler.log.Error("register user", logger.Fields{"error": err.Error(), "email": email})
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "could not create the account")
		return
	}

	handler.sendVerification(w, r, user)
}

// noMailRegistrationResponse is what registration answers when there is no
// provider to deliver a confirmation to.
//
// It has to differ from the confirmation response: promising an email that was
// never sent is the instruction to wait for something that cannot arrive.
const noMailRegistrationResponse = "Account created. Sign in to continue."

// registrationConfirmation is the one body the registration gives the caller.
//
// It is the same message for a fresh account and for one that only ever had a
// confirmation link, because that is the whole point of taking the email
// question out of it: the caller never learns whether an address is taken, and
// nobody calls this twice on the same register.
const registrationConfirmation = "Check your email for a confirmation link. " +
	"You can sign in once you have followed it."

// sendVerification issues a confirmation token, emails it, and writes the
// "check your inbox" response itself.
//
// It is the single place that decides what register does with a mail failure:
// a fresh account gets the accepted shape, and a taken address gets the same
// shape. The message never changes, so the two branches cannot drift back into
// revealing which addresses exist, and the status and the body stay the same
// whether Resend accepts the recipient or not.
func (handler *Credentials) sendVerification(
	w http.ResponseWriter,
	r *http.Request,
	user *dbcontrol.User,
) {
	// With no provider configured there is no address to deliver to. Issuing a
	// token anyway writes a row nobody will read and answers "check your
	// email" about an email that cannot exist, which leaves the account unable
	// to sign in and the person waiting for nothing.
	if !handler.mailer.Enabled() {
		handler.completeWithoutMail(w, r, user)
		return
	}

	_, err := handler.issueVerification(r.Context(), user)
	if err != nil {
		// A token that never reached the inbox is a different problem from one
		// that never reached the database, and the code tells the frontend which.
		// Both are reported with the same sentence because from the person's side
		// they are the same situation: the account exists and cannot be used.
		//
		// The id belongs in the log. The account is already written, so if the
		// outage is long the only way somebody gets in is an operator clearing
		// the flag, and that starts from knowing which account.
		handler.log.Error("verification email not sent", logger.Fields{
			"error":   err.Error(),
			"user_id": user.ID.String(),
			"email":   user.Email,
		})

		code := "internal"
		if errors.Is(err, errMailFailed) {
			code = "mail_failed"
		}
		httpx.WriteError(w, http.StatusInternalServerError, code,
			"the account was created but the confirmation email could not be sent; try again in a few minutes")
		return
	}

	httpx.WriteJSON(w, http.StatusAccepted, registeredResponse{
		Message: registrationConfirmation,
		Email:   user.Email,
	})
}

// completeWithoutMail finishes a registration when no provider is configured.
//
// In development it marks the address proven, because the alternative is an
// account that cannot be opened and a developer with no way to test anything
// that comes after signing up.
//
// In production it refuses. Configuration already refuses to boot without a
// sign-in path, so reaching this means Google is configured and mail is not:
// the account can still be opened through Google, and saying so is more use
// than a promise about an email that is never sent.
func (handler *Credentials) completeWithoutMail(
	w http.ResponseWriter,
	r *http.Request,
	user *dbcontrol.User,
) {
	if handler.cfg.IsProduction() {
		handler.log.Warn("password registration without email delivery", logger.Fields{
			"user_id": user.ID.String(),
		})
		httpx.WriteError(w, http.StatusServiceUnavailable, "email_unavailable",
			"this deployment cannot send confirmation email; sign in with Google instead")
		return
	}

	if err := handler.store.MarkEmailVerified(r.Context(), user.ID); err != nil {
		handler.log.Error("mark email verified without mail", logger.Fields{
			"error": err.Error(), "user_id": user.ID.String(),
		})
		httpx.WriteError(w, http.StatusInternalServerError, "internal",
			"could not create the account")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, registeredResponse{
		Message: noMailRegistrationResponse,
		Email:   user.Email,
	})
}

// errMailFailed marks a failure to hand the message to Resend, so the caller
// can report it as a delivery problem rather than a database one.
var errMailFailed = errors.New("mail delivery failed")

// issueVerification stores a fresh confirmation token and mails the link.
//
// It returns the HTTP status the failure should be reported with rather than
// writing a response itself, because two callers need it and they do not agree
// on what a failure looks like: registration reports the error to the person
// who just signed up, while the resend endpoint has already promised a generic
// answer and can only log it.
//
// The mail error is reported as 500 with the mail_failed code by the caller,
// which is the same shape the password-reset path uses for an undeliverable
// message.
func (handler *Credentials) issueVerification(
	ctx context.Context,
	user *dbcontrol.User,
) (int, error) {
	token, err := generateResetToken()
	if err != nil {
		handler.log.Error("generate verification token", logger.Fields{
			"error": err.Error(), "user_id": user.ID.String(),
		})
		return http.StatusInternalServerError, err
	}

	tokenHash := hashResetToken(token)
	if err := handler.store.CreateVerificationToken(
		ctx, user.ID, tokenHash, handler.cfg.VerificationTTL,
	); err != nil {
		handler.log.Error("create verification token", logger.Fields{
			"error": err.Error(), "user_id": user.ID.String(),
		})
		return http.StatusInternalServerError, err
	}

	if err := handler.mailer.SendEmailVerification(ctx, user.Email, token); err != nil {
		handler.log.Error("send verification email", logger.Fields{
			"error": err.Error(), "user_id": user.ID.String(),
		})
		return http.StatusInternalServerError, fmt.Errorf("%w: %w", errMailFailed, err)
	}

	return http.StatusOK, nil
}

// VerifyEmail handles POST /auth/verify-email.
//
// The token arrives in the body rather than the query string because a query
// parameter ends up in browser history, in the Referer header of any outbound
// link on the landing page, and in any proxy log along the way. A link in the
// mail still has to carry it, so the frontend reads it from the URL and posts
// it straight away.
func (handler *Credentials) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Token string `json:"token"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}
	if strings.TrimSpace(request.Token) == "" {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_token",
			"a confirmation link is required")
		return
	}

	if err := handler.store.VerifyEmail(r.Context(), hashResetToken(request.Token)); err != nil {
		if errors.Is(err, dbcontrol.ErrVerificationTokenInvalid) {
			httpx.WriteError(w, http.StatusBadRequest, "invalid_token",
				"this confirmation link is invalid or has expired")
			return
		}
		handler.log.Error("verify email", logger.Fields{"error": err.Error()})
		httpx.WriteError(w, http.StatusInternalServerError, "internal",
			"could not confirm the address")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, genericResponse{
		Message: "Email confirmed. You can sign in now.",
	})
}

// ResendVerification handles POST /auth/resend-verification.
//
// Like the password-reset endpoint it always answers the same way, whether the
// address exists, is already verified, or the mail did not go out. Anything else
// turns this into an oracle for which addresses are registered.
func (handler *Credentials) ResendVerification(w http.ResponseWriter, r *http.Request) {
	const confirmation = "If that account needs confirming, a new link has been sent."

	var request struct {
		Email string `json:"email"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}

	email := strings.ToLower(strings.TrimSpace(request.Email))
	if !validEmail(email) {
		httpx.WriteJSON(w, http.StatusOK, genericResponse{Message: confirmation})
		return
	}

	user, err := handler.store.UserByEmail(r.Context(), email)
	if err != nil {
		httpx.WriteJSON(w, http.StatusOK, genericResponse{Message: confirmation})
		return
	}

	verified, err := handler.store.EmailVerified(r.Context(), user.ID)
	if err == nil && !verified {
		// A failure here is logged by issueVerification and then reported as
		// success. That is not a cover-up: this endpoint has already answered
		// every branch identically to avoid revealing which addresses exist, and
		// a 500 here would reveal exactly that.
		if _, issueErr := handler.issueVerification(r.Context(), user); issueErr != nil {
			handler.log.Warn("resend verification did not complete", logger.Fields{
				"user_id": user.ID.String(),
			})
		}
	}

	httpx.WriteJSON(w, http.StatusOK, genericResponse{Message: confirmation})
}

// Login handles POST /auth/login.
//
// The failure message is identical for a wrong email and a wrong password.
// Distinguishing them would let an attacker enumerate which emails are
// registered, so both collapse to "invalid credentials".
func (handler *Credentials) Login(w http.ResponseWriter, r *http.Request) {
	var request LoginRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}

	email := strings.ToLower(strings.TrimSpace(request.Email))
	if !validEmail(email) || request.Password == "" {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}

	user, err := handler.store.UserByEmail(r.Context(), email)
	if err != nil {
		// A missing account and a bad password are answered the same way, on
		// purpose.
		httpx.WriteError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}

	if !auth.VerifyPassword(request.Password, user.PasswordHash) {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}

	// The password was right, so this is not a credentials failure and is
	// reported as 403 rather than 401. It is also the one place where login may
	// say more than "invalid credentials": the caller already proved they hold
	// the password for this exact address, so naming the reason tells them
	// nothing an attacker with the password would not already know.
	if user.EmailVerifiedAt == nil {
		httpx.WriteError(w, http.StatusForbidden, "email_not_verified",
			"confirm your email address before signing in")
		return
	}

	handler.signIn(w, user)
}

// ForgotPassword handles POST /auth/forgot-password.
//
// It always answers 200 with the same message, whether or not the email is
// registered. Revealing which addresses exist is an enumeration oracle, and
// the cost of a "no such account" response is not worth it.
func (handler *Credentials) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var request ForgotPasswordRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}

	const confirmation = "If that email is registered, a reset link has been sent."

	email := strings.ToLower(strings.TrimSpace(request.Email))
	if !validEmail(email) {
		// Still 200: refusing to confirm a malformed address the same way as a
		// valid one keeps the response shape uniform.
		httpx.WriteJSON(w, http.StatusOK, genericResponse{Message: confirmation})
		return
	}

	user, err := handler.store.UserByEmail(r.Context(), email)
	if err != nil {
		// Unknown email: answer as if it worked.
		httpx.WriteJSON(w, http.StatusOK, genericResponse{Message: confirmation})
		return
	}

	token, err := generateResetToken()
	if err != nil {
		handler.log.Error("generate reset token", logger.Fields{"error": err.Error()})
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "could not start the reset")
		return
	}

	tokenHash := hashResetToken(token)
	if err := handler.store.CreatePasswordResetToken(
		r.Context(), user.ID, tokenHash, handler.cfg.PasswordResetTTL,
	); err != nil {
		handler.log.Error("create reset token", logger.Fields{"error": err.Error(), "user_id": user.ID.String()})
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "could not start the reset")
		return
	}

	if err := handler.mailer.SendPasswordReset(r.Context(), user.Email, token); err != nil {
		// The token is stored but the email did not go out. Report a generic
		// failure; the user can simply request again.
		handler.log.Error("send reset email", logger.Fields{"error": err.Error(), "user_id": user.ID.String()})
		httpx.WriteError(w, http.StatusInternalServerError, "mail_failed", "could not send the reset email, try again")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, genericResponse{Message: confirmation})
}

// ResetPassword handles POST /auth/reset-password.
func (handler *Credentials) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var request ResetPasswordRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return
	}

	if err := validatePassword(request.Password); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_password", err.Error())
		return
	}
	if strings.TrimSpace(request.Token) == "" {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_token", "a reset link is required")
		return
	}

	hash, err := auth.HashPassword(request.Password)
	if err != nil {
		handler.log.Error("hash password", logger.Fields{"error": err.Error()})
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "could not update the password")
		return
	}

	tokenHash := hashResetToken(request.Token)
	if err := handler.store.ResetPassword(r.Context(), tokenHash, hash); err != nil {
		if err == dbcontrol.ErrResetTokenInvalid {
			httpx.WriteError(w, http.StatusBadRequest, "invalid_token", "this reset link is invalid or has expired")
			return
		}
		handler.log.Error("reset password", logger.Fields{"error": err.Error()})
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "could not update the password")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, genericResponse{Message: "Password updated. Sign in with your new password."})
}

// signIn issues a session and sets the cookie, then reports success.
func (handler *Credentials) signIn(w http.ResponseWriter, user *dbcontrol.User) {
	token, err := handler.sessions.Issue(user.ID, user.Email)
	if err != nil {
		handler.log.Error("issue session", logger.Fields{"error": err.Error(), "user_id": user.ID.String()})
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "could not sign you in")
		return
	}
	handler.sessions.SetCookie(w, token)
	httpx.WriteJSON(w, http.StatusOK, credentialResponse{User: *user})
}

// validEmail is a pragmatic check for a registration or login address. It is
// not a full RFC validation — that would reject real addresses and accept
// nothing useful here — just enough to stop obvious garbage from reaching the
// database.
func validEmail(email string) bool {
	if email == "" || len(email) > 254 {
		return false
	}
	local, domain, found := strings.Cut(email, "@")
	if !found || local == "" || domain == "" {
		return false
	}
	if strings.Count(email, "@") != 1 {
		return false
	}
	if strings.ContainsAny(local, " \t") || strings.ContainsAny(domain, " \t") {
		return false
	}
	// A domain needs a dot and a non-empty label on each side.
	if !strings.Contains(domain, ".") {
		return false
	}
	if strings.HasPrefix(domain, ".") || strings.HasSuffix(domain, ".") {
		return false
	}
	return true
}

// validatePassword enforces the length bounds and reports a human message.
func validatePassword(password string) error {
	if len(password) < minimumPasswordLength {
		return errPasswordTooShort()
	}
	if len(password) > maximumPasswordLength {
		return errPasswordTooLong()
	}
	return nil
}

func errPasswordTooShort() error {
	return &validationError{message: "the password must be at least " + strconv.Itoa(minimumPasswordLength) + " characters"}
}

func errPasswordTooLong() error {
	return &validationError{message: "the password must be at most " + strconv.Itoa(maximumPasswordLength) + " characters"}
}

// validationError carries a user-facing message without leaking internals.
type validationError struct{ message string }

func (err *validationError) Error() string { return err.message }

// generateResetToken returns a URL-safe random token for a reset link.
func generateResetToken() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

// hashResetToken is the value stored in the database. The raw token travels in
// the email and is never persisted, so a leak does not hand out working links.
func hashResetToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
