# Deployment Guide — Proof of Concept (Step 1)

This guide sets up the **connection test** only, not the business application.
You do every step once. Allow about 45 minutes.

> **Important:** the code in GitHub and the live backend are **separate copies**.
> Changing a `.gs` file in GitHub does **not** change the live backend. You must
> paste the change into the Apps Script editor and publish a new version (Part F).

You need: one Google account (Gmail is fine). It will own the backend and the data.

---

## Part A — Create the Apps Script project (the backend)

1. Go to <https://script.google.com> → **New project**.
2. Click "Untitled project" at the top and rename it to **AgriChain 360 Backend**.
3. Delete the sample code in `Code.gs` and paste the contents of `backend/Code.gs`.
4. For each of the other backend files, click **+** next to "Files" → **Script**, type the
   name **without** `.gs`, and paste its contents:
   `Config`, `Response`, `Database`, `Auth`, `Poc`.
5. Click ⚙️ **Project Settings** → tick **Show "appsscript.json" manifest file in editor**.
   Go back to the editor, open `appsscript.json`, and replace its contents with `backend/appsscript.json`.
6. Click 💾 **Save**.

## Part B — Create the database (run once)

1. In the editor's function dropdown (top toolbar), choose **setupPocDatabase** → **Run**.
2. Google asks for permission. Click **Review permissions**, then choose your account.
   You will see "Google hasn't verified this app". That is expected, because it is your own script.
   Click **Advanced → Go to AgriChain 360 Backend (unsafe) → Allow**.
3. Open **Execution log**. It prints `Setup complete. Spreadsheet: https://docs.google.com/...`.
   Open that link. You should see 4 tabs: `tblUsers`, `tblSequences`, `tblPocNotes`, `tblAuditLog`,
   and `tblUsers` should contain your email with role **ADMIN**.
4. **Do not share this spreadsheet with anyone.** All access must go through the backend.

## Part C — Create a Google Sign-In Client ID

The Client ID tells Google which website is allowed to ask for sign-in. **It is not a secret.**
You will **not** need a client *secret*. If Google offers one, do not download it or commit it.

1. Go to <https://console.cloud.google.com> → create a project named **AgriChain 360**.
2. Open **APIs & Services → OAuth consent screen**. In newer consoles this may be called **Google Auth Platform → Branding / Audience**.
   - User type: **External**. App name: **AgriChain 360**. Fill in your email where asked.
   - Under **Test users** (Audience), add your own Gmail address.
3. Open **Credentials** (or **Clients**) → **Create credentials → OAuth client ID**.
   - Application type: **Web application**. Name: **AgriChain 360 Web**.
   - **Authorized JavaScript origins**, add both:
     - `https://rajdeep130.github.io`
     - `http://localhost:8000`
   - No redirect URIs are needed.
4. Copy the **Client ID** (ends with `.apps.googleusercontent.com`).

> Google changes this console's layout often. If a menu name differs, look for "OAuth consent"
> and "Create OAuth client ID".

## Part D — Tell the backend your Client ID

1. Apps Script editor → ⚙️ **Project Settings** → **Script Properties** → **Add script property**.
2. Property: `GOOGLE_CLIENT_ID`. Value: the **Client ID** from Part C (ends with `.apps.googleusercontent.com`;
   **not** the Client secret that starts with `GOCSPX-`). Click **Save**.
   (`SPREADSHEET_ID` is already there. Part B created it.)

## Part E — Publish the backend as a web app

1. Editor → **Deploy → New deployment** → ⚙️ type **Web app**.
2. Description: `POC v1`. **Execute as: Me**. **Who has access: Anyone**.
3. Click **Deploy** and copy the **Web app URL** (ends with `/exec`).
4. Paste the URL into a browser tab. You should see JSON containing `"Backend is running"`.

*Why "Anyone"?* GitHub Pages cannot pass through a Google login screen. The backend is reachable
by anyone, but it **rejects every protected action** unless the caller sends a valid Google
sign-in token belonging to an ACTIVE user in `tblUsers`.

## Part F — Updating the backend later

After changing backend code: paste the change into the editor, save, then
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
The URL stays the same. If you skip this step, the live backend keeps running the old code.

## Part G — Configure and run the frontend locally

1. Edit `frontend/assets/js/config.js`: set `API_URL` (Part E) and `GOOGLE_CLIENT_ID` (Part C).
   Both values are public, so committing them is fine.
2. In a terminal:
   ```
   cd frontend
   python3 -m http.server 8000
   ```
3. Open <http://localhost:8000>. Google Sign-In does **not** work if you double-click `index.html`
   (a `file://` address). It needs a real web address.

## Part H — Publish the frontend on GitHub Pages

1. GitHub → repository **Settings → Pages → Source: GitHub Actions**.
2. When this work is merged into `main`, the workflow `.github/workflows/pages.yml` runs the tests and
   publishes the `frontend/` folder.
3. The site appears at `https://rajdeep130.github.io/AgriValueChain/`.

---

## Proof-of-concept checklist (record your results in docs/TESTING.md)

| # | Test | How | Expected |
|---|---|---|---|
| 1 | Request from deployed frontend | Click **Ping** on the GitHub Pages site | ✔ `pong` |
| 2 | Access restriction | Click **Call without sign-in** | ✖ `UNAUTHENTICATED` |
| 3 | Authentication | Sign in, then click **Who am I?** | ✔ your email, role ADMIN |
| 4 | Read | Click **Read notes** | ✔ `0 note(s)` the first time |
| 5 | Write | Type a note, then **Save note** | ✔ `Note saved`, ID `NOTE000001`; row appears in `tblPocNotes` and `tblAuditLog` |
| 6 | Input validation | Click **Save note** with an empty box | ✖ `VALIDATION_ERROR` |
| 7 | Failed request | Click **Unreachable server** | ✖ `NETWORK_ERROR` |
| 8 | Authorization | In the sheet, change your role to `ANALYST`, then try **Save note** (change it back afterwards) | ✖ `FORBIDDEN`, no new row |
| 9 | Unregistered user | Sign in with a different Google account (add it as a test user in Part C) | ✖ `FORBIDDEN` |
