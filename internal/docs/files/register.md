# Register

An account is one email address and a password. That is the whole identity
system: there are no organisations, no invitations, and no roles to assign.

## Create your account

1. Go to the [register page](/register), or click **Register / Login** in the
   header.
2. Fill in the form.

| Field | Required | Notes |
|---|---|---|
| Name | No | Shown in the dashboard. You can leave it empty. |
| Email | Yes | This is your identity. One email is one account. |
| Password | Yes | At least 8 characters. |
| Confirm password | Yes | Must match exactly. |

3. Click **Create account**.

## Confirm your email address

Registration does not sign you in. It creates the account and sends a
confirmation link to the address you typed, and the account cannot be used until
you follow it.

This exists because a typed address proves nothing. Without it, anybody could
register your email address and lock you out of an account they cannot get into.

The link:

- Expires after **24 hours**.
- Works **once**. Following it twice reports it as expired, which is the correct
  answer — it has already been used.
- Brings you to `/verify-email`, which exchanges it and signs you in on the next
  click.

**Nothing arrived?** The link is in your spam folder more often than not. The
login page can send a fresh one: try to sign in, and when it says the address is
not confirmed, offer **Send a new link**. That path answers the same way whether
or not an account exists, so it will not tell you whether your address is
registered.

> **If sending fails**, the registration is rejected with `mail_failed` rather
> than accepted quietly. That is deliberate: accepting quietly would leave you
> waiting on an inbox that will never receive anything. The half-finished
> account is removed before the error is returned, so registering again with
> the same address simply starts over.

## Sign in

Go to [the login page](/login) and enter the email and password you registered
with. Your session is stored in a cookie, so your browser stays signed in for
seven days.

If you are already signed in, visiting `/login` takes you to the dashboard
instead of showing the form.

An account that has not confirmed its address gets `403 email_not_verified`
rather than a normal session. The login page turns that into a prompt to resend
the link instead of an error above the same form.

## Sign out

Click your account in the top-right of the dashboard and choose **Sign out**.
The response clears the session cookie in this browser, and it also bumps an
epoch on the account — every session issued before that bump stops verifying,
on every device at once. One sign-out signs the other browsers out too: each
token carries the epoch it was issued under, and after the bump it no longer
matches. Nothing else has to be reached for.

## Forgotten password

1. Go to [the forgot password page](/forgot-password).
2. Enter your email address.
3. Check your inbox for a reset link.

The link expires after **one hour** and can only be used once.

> **Nothing arrived?** Reset emails are sent only to addresses that have an
> account. If the address is not registered, no email is sent. This is
> deliberate: telling an anonymous caller whether an address has an account
> would turn the form into an account-enumeration oracle.
>
> Password reset works on an account whose address has not been confirmed yet.
> It is the same thing: the link proves you can read mail at that address.

Once you have the link, you will land on a page where you choose a new password.

## Signing in with Google

Moogo also supports Google sign-in, and it is the recommended path when the
deployment has been configured for it.

Clicking **Continue with Google** sends you to Google's consent screen and back.
The email Google returns is always verified, so no email confirmation is needed
either — a Google account is created already confirmed and stays confirmed.

If Google sign-in is not configured on the deployment you are using, the button
is not shown at all and the email and password form is the only way in. Nothing
on your side needs to change either way.

### What an operator has to configure

The button appears only when both of these are set:

```
MOOGO_GOOGLE_CLIENT_ID=...your client id...
MOOGO_GOOGLE_CLIENT_SECRET=...your client secret...
```

Create them in the Google Cloud Console: **APIs & Services → Credentials → Create
Credentials → OAuth client ID → Application type: Web application**. Then set
the **Authorized redirect URI** to exactly:

```
<MOOGO_PUBLIC_URL>/auth/google/callback
```

It has to match character for character, including `http` versus `https` and any
port. A mismatch comes back as Google's `redirect_uri_mismatch` error.

## How sessions work

- The session is a signed, `HttpOnly` cookie marked `Secure` and `SameSite=Lax`.
- It lasts **7 days**.
- It is scoped to the browser that created it. Signing in on a different device is
  a separate sign-in.

Your session authorises the **dashboard**. It is not the credential your
application uses — that is a [project key](/docs/credentials), and the dashboard
never sees it.

## Confirming an address

If you followed a confirmation link already, the exchange is a `POST` of the
token rather than a `GET` on it. A token in a query string is recorded in
browser history and in the `Referer` header of any link followed afterwards, so
the page reads it from the address and posts it immediately, then clears the
address bar.

## What happens next

With an account, the next step is to
[create your first project](/docs/create-project), which is where your database
and your key come from.