# The bucket tab

Browse, upload, and organise files.

- **Upload** respects the bucket's policy, so a rejected file tells you why —
  wrong type or over the size cap.
- **Preview** renders images, video, audio, and text inline. Private files preview
  correctly because the dashboard uses its own session-scoped route rather than
  the credential-requiring URL.
- **Public** toggles whether an object is readable at a URL with no credential.
- **Credentials** manages [storage credentials](/docs/credentials) and shows each
  secret once on creation.

Renaming and deleting work on objects and on whole prefixes.

### Bucket settings

The **Settings** tab has its own URL so it can be bookmarked or shared. To view
settings for a specific bucket, append its name as a query parameter:

```
/app/projects/{project_id}/bucket/settings?bucket=image
```

The page will load the settings form for that bucket, and the name will appear
pre‑filled in the UI.

### Download a backup

**Download backup** gives you the whole database as a `.db` file.

It uses your session, not a project key, so it works from the dashboard even if
you have lost the key.

Take one before anything destructive — a large edit through the spreadsheet, a
schema change, or a bulk delete. It is a full SQLite file, so you can open it with
any SQLite tooling.