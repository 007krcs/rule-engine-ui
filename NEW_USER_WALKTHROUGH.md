# New User Walkthrough (Click-By-Click)

Goal: clone a sample config, edit UI, add a rule, run in Playground, and understand the trace with Explain mode.

## 0) Start The Product

1. Run `pnpm dev`
2. Open `http://localhost:3000`

Tip: Press `Ctrl+K` for the Command Palette.

## 1) Clone A Sample Config (Creates versionId)

1. Click **Get Started** (header) or **Getting Started** (sidebar).
2. In Step 1, under **Sample Projects**, click **Clone into tenant** on:
   - **Fast Start: Submit + Trace** (recommended), or
   - **Checkout Flow**, or
   - **Loan Onboarding**
3. Confirm you see **Active versionId** populated at the top of the wizard.

Expected outcome:
- A new **DRAFT** config version is created and the wizard shows `PASS` for Step 1.

## 2) Open Builder And Modify UI

1. In the wizard Step 2, click **Open Builder**.
2. In the left **Component Palette**, drag any item onto the **Canvas**.
3. Click the new component on the Canvas.
4. In **Properties**, change a prop (example: label text).
5. Click **Save**.

Expected outcome:
- Save succeeds (no validation issues).
- Wizard shows `PASS` for Step 2 and Step 5 (Save to DB).

If Save is disabled:
- Scroll to **Schema Preview** and click an issue to focus the offending component.
- Fix missing `ariaLabelKey` / required props / invalid focus order.

## 3) Add A Rule (Beginner-Friendly)

1. In the wizard Step 3, click **Open Rules Builder**.
2. Click **Add starter rule**.
3. Click **Save**.

Expected outcome:
- Wizard shows `PASS` for Step 3.

## 4) Run In Playground And Generate Trace

1. In the wizard Step 6, click **Auto-run Submit** (or **Open Playground** then press **Submit**).
2. In Playground, confirm the **Trace** panel shows Flow + Rules information.
3. Toggle **Explain** mode (or use wizard Step 7: **Open Trace + Explain**).

Expected outcome:
- Wizard shows `PASS` for Step 6 (Run) and Step 7 (Inspect Trace).
- Explain mode shows which clauses were true/false, what fields were read, and which actions changed data.

## 5) View Trace Details (Flow + Rules + API)

1. In Trace panel:
   - Expand **Rules** to see matched rules and clause-level results.
   - Review **Reads** and **Action diffs** (before/after).
2. If the sample includes an API mapping, expand **API** to see endpoint/request/response.

## 6) Export A GitOps Bundle

1. Click **Export GitOps** (header) or go to **Console** -> **GitOps Package**.
2. Click **Export** to download `ruleflow-gitops.json`.

Expected outcome:
- Wizard shows `PASS` for Step 8 (Export GitOps).

## Optional: Register Your Own Component Manifest

1. Go to `/component-registry`
2. Paste a manifest JSON and click **Register**
3. Go back to Builder: your components appear in the palette immediately.

