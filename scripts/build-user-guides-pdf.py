from __future__ import annotations

import os
import hashlib
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, KeepTogether,
    PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
SCREENSHOTS = ROOT / "website-next" / "public" / "user-guide" / "images"
TODAY = "November 1, 2026"
VERSION = "0.3.27"
NAVY = colors.HexColor("#152B3D")
COPPER = colors.HexColor("#A95335")
PALE = colors.HexColor("#F1F5F7")
INK = colors.HexColor("#24313A")
MUTED = colors.HexColor("#52616C")
LINE = colors.HexColor("#CED7DD")
GREEN = colors.HexColor("#EAF3EF")
AMBER = colors.HexColor("#FFF4E2")


def clean_text(value: str) -> str:
    return (value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "-")
            .replace("\u2018", "'").replace("\u2019", "'")
            .replace("\u201c", '"').replace("\u201d", '"'))


class GuideDoc(BaseDocTemplate):
    def __init__(self, filename: Path, title: str, short_title: str):
        super().__init__(str(filename), pagesize=letter, leftMargin=0.68 * inch,
                         rightMargin=0.68 * inch, topMargin=0.72 * inch,
                         bottomMargin=0.68 * inch, title=title,
                         author="OverHead Product Documentation",
                         subject=f"OverHead {short_title} user guide, release {VERSION}")
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height,
                      leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
                      id="main")
        self.addPageTemplates([PageTemplate(id="guide", frames=[frame], onPage=self._page_chrome)])
        self.short_title = short_title

    def _page_chrome(self, canvas, doc):
        if doc.page == 1:
            return
        canvas.saveState()
        w, h = letter
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.55)
        canvas.line(doc.leftMargin, h - 0.48 * inch, w - doc.rightMargin, h - 0.48 * inch)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(NAVY)
        canvas.drawString(doc.leftMargin, h - 0.36 * inch, self.short_title.upper())
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(w - doc.rightMargin, h - 0.36 * inch, f"Release {VERSION}  |  {TODAY}")
        canvas.line(doc.leftMargin, 0.47 * inch, w - doc.rightMargin, 0.47 * inch)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(doc.leftMargin, 0.31 * inch, "OverHead user guide")
        canvas.drawRightString(w - doc.rightMargin, 0.31 * inch, str(doc.page))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == "GuideHeading1":
            text = flowable.getPlainText()
            key = "section-" + hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, 0, False)
            self.notify("TOCEntry", (0, text, self.page, key))


def styles_for(short_title: str):
    base = getSampleStyleSheet()
    return {
        "cover_tag": ParagraphStyle("CoverTag", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=10, leading=14, textColor=COPPER, spaceAfter=12, tracking=1.4),
        "cover_title": ParagraphStyle("CoverTitle", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=31, leading=35, textColor=NAVY, alignment=TA_LEFT, spaceAfter=10),
        "cover_subtitle": ParagraphStyle("CoverSubtitle", parent=base["Normal"], fontName="Helvetica",
            fontSize=15, leading=21, textColor=MUTED, spaceAfter=20),
        "cover_meta": ParagraphStyle("CoverMeta", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=10, leading=16, textColor=NAVY, spaceAfter=4),
        "cover_note": ParagraphStyle("CoverNote", parent=base["Normal"], fontName="Helvetica",
            fontSize=9.5, leading=14, textColor=MUTED, spaceAfter=8),
        "h1": ParagraphStyle("GuideHeading1", parent=base["Heading1"], fontName="Helvetica-Bold",
            fontSize=18, leading=22, textColor=NAVY, spaceBefore=8, spaceAfter=11, keepWithNext=True),
        "h2": ParagraphStyle("GuideHeading2", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=11.5, leading=15, textColor=COPPER, spaceBefore=9, spaceAfter=4, keepWithNext=True),
        "body": ParagraphStyle("GuideBody", parent=base["BodyText"], fontName="Helvetica",
            fontSize=9.4, leading=13.4, textColor=INK, spaceAfter=6, alignment=TA_LEFT),
        "bullet": ParagraphStyle("GuideBullet", parent=base["BodyText"], fontName="Helvetica",
            fontSize=9.2, leading=12.8, textColor=INK, spaceAfter=2.5),
        "small": ParagraphStyle("GuideSmall", parent=base["BodyText"], fontName="Helvetica",
            fontSize=8.1, leading=10.8, textColor=MUTED, spaceAfter=4),
        "caption": ParagraphStyle("GuideCaption", parent=base["BodyText"], fontName="Helvetica-Oblique",
            fontSize=8, leading=10.5, textColor=MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=9),
        "toc_title": ParagraphStyle("GuideTOCTitle", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=23, leading=28, textColor=NAVY, spaceAfter=12),
        "toc1": ParagraphStyle("GuideTOC1", fontName="Helvetica", fontSize=10, leading=15,
            leftIndent=0, firstLineIndent=0, textColor=INK, spaceBefore=2),
    }


def paragraph(text: str, style):
    return Paragraph(clean_text(text), style)


def bullets(items, style):
    item_style = ParagraphStyle("GuideBulletItem", parent=style, leftIndent=11, firstLineIndent=-10)
    return [paragraph("- " + item, item_style) for item in items] + [Spacer(1, 4)]


def steps(items, style):
    item_style = ParagraphStyle("GuideStepItem", parent=style, leftIndent=18, firstLineIndent=-17)
    return [paragraph(f"{index}. {item}", item_style) for index, item in enumerate(items, 1)] + [Spacer(1, 4)]


def callout(title: str, text: str, width: float, tone="blue", styles=None):
    bg = GREEN if tone == "green" else AMBER if tone == "amber" else PALE
    text_color = NAVY if tone != "amber" else colors.HexColor("#704A16")
    content = [Paragraph(f"<b>{clean_text(title)}</b><br/>{clean_text(text)}", ParagraphStyle(
        "Callout", fontName="Helvetica", fontSize=9.1, leading=13, textColor=text_color))]
    table = Table([[content]], colWidths=[width])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    table.spaceBefore, table.spaceAfter = 4, 9
    return table


def data_table(rows, widths, styles):
    cooked = []
    for row_index, row in enumerate(rows):
        cooked.append([paragraph(str(cell), styles["small"] if row_index else ParagraphStyle(
            "TableHeader", parent=styles["small"], fontName="Helvetica-Bold", textColor=colors.white))
                       for cell in row])
    table = Table(cooked, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    table.spaceBefore, table.spaceAfter = 5, 9
    return table


def screenshot(filename: str, caption: str, max_width: float):
    image_path = SCREENSHOTS / filename
    if not image_path.exists():
        return []
    flow = Image(str(image_path))
    flow._restrictSize(max_width, 3.65 * inch)
    flow.hAlign = "CENTER"
    return [Spacer(1, 4), flow, paragraph(caption, styles_for("x")["caption"])]


DESKTOP_SECTIONS = [
    {
        "title": "1. Choose the right OverHead package",
        "parts": [
            ("p", "OverHead Desktop is the individual-user office workspace for a regular Windows 10 or Windows 11 workstation. Cylinder Server is for supported Windows Server or Windows IoT hosts. Cylinder Client is for managed Windows 10/11 endpoints connected to a Cylinder workspace. The products share daily office workflows, but use separate installers, data folders, and update feeds."),
            ("table", [["Package", "Use", "Important boundary"], ["OverHead Desktop", "Windows 10/11 workstation", "Individual-user workspace; no department Rank/device control plane."], ["Cylinder Server", "Supported Server/IoT host", "Department host; manages Cylinder membership, departments, Ranks, and devices."], ["Cylinder Client", "Managed Windows 10/11 workstation", "Employee endpoint; it does not administer the department."]], [1.32*inch, 1.85*inch, 3.16*inch]),
            ("callout", ("Local-first data", "Customer records and attachments remain on the computer where they are stored unless you explicitly use a supported sync or export. Accounts, security, and plan status can use connected services; that does not make local business files automatically synchronize.", "blue")),
            ("p", "The screenshots in this guide are illustrative examples. Product labels, sections, available actions, and access can vary with version, account role, plan, settings, and connected services."),
        ],
    },
    {
        "title": "2. Install and open your workspace",
        "parts": [
            ("steps", ["Use the official OverHead download page or an approved organization distribution share. Confirm the product name and version before opening the installer.", "Run the product installer and follow its Windows prompts. If using a ZIP, extract all files and keep the folder together; do not launch the application from inside the ZIP.", "Open OverHead from the installed shortcut. Choose the correct Desktop or Cylinder package; never install one product over another.", "On first use, review the Manager's first-install notices when presented. Choose the explicit Yes, I agree option to proceed. Choosing No, I do not agree cancels the first-install flow.", "Create a workspace or sign in with the approved work account. Complete email verification if requested." ]),
            ("callout", ("Before installation", "The Manager checks Windows compatibility, hardware, available space, package integrity, and publisher status according to the Manager build's policy. An unsigned local Manager can verify release hashes but cannot independently identify the publisher.", "amber")),
            ("h2", "Create a workspace or join the staff workspace"),
            ("p", "For a new office workspace, choose Create Workspace and enter the requested owner and business details. Use a unique password. For an existing staff identity, select OverHead Team and sign in with the account issued for your workspace. Customer Access is a separate customer support portal; it does not open the staff workspace."),
            ("p", "After sign-in, confirm the business name and role on Team Dashboard. If access is limited, review the account's plan and role with the workspace owner instead of creating a duplicate account."),
        ],
    },
    {
        "title": "3. Sign in, verify email, and recover access",
        "parts": [
            ("steps", ["Choose the correct sign-in mode: staff workspace, customer support access, or workspace creation.", "Enter the account email/username first and continue. OverHead checks the account before presenting the password step.", "Enter the password. Use the sign-in page's Forgot your password link if you cannot remember it, then follow the current email instructions.", "Open the newest verification or recovery email. Use its link promptly and return to OverHead to finish sign-in.", "If the link has expired, request a new one. Do not forward password-reset links, verification links, or recovery details to another person."]),
            ("callout", ("Keep one identity per account", "A username check is an account lookup, not proof that the person entering it owns the account. Passwords and recovery links remain private. Contact the workspace owner or support if email access has been lost.", "blue")),
            ("p", "Repeated failures may be caused by a typo, an unverified email, an expired link, stale connectivity, or the wrong account mode. Record the exact message and step that failed; never send your password or recovery token in a support request."),
        ],
    },
    {
        "title": "4. Navigate and use the dashboard",
        "parts": [
            ("p", "Use the left navigation to open a workspace. Scroll the main area to reach controls below the first screen. The top search, command palette, action inbox, setup checklist, privacy toggle, lock control, and update control provide common shortcuts."),
            ("steps", ["Start on Team Dashboard and review Current work.", "Use Open, Queued, Blocked, Complete, or All to filter work; clear the search if expected records are missing.", "Add one specific next action as a note or reminder. Mark a task Done only after completing the real-world work.", "Use Customize dashboard or the Workspace directory to hide, reorder, or group navigation items. These preferences are local display settings; hiding a section does not change permissions."]),
            ("callout", ("Status is a record", "A Completed quote, invoice, task, or appointment status records what was entered in OverHead. It does not prove that an email was delivered, a customer accepted an offer, or a payment was processed.", "amber")),
            ("image", ("dashboard.jpg", "Example: dashboard and current-work overview.")),
        ],
    },
    {
        "title": "5. Add customers and manage documents",
        "parts": [
            ("steps", ["Open Customers and find Add customer.", "Enter the business and contact details requested by the form. Review the email address and preferred contact method.", "Select Add Customer and wait for confirmation before submitting again.", "Use search to find the saved customer and confirm the selected name before creating related work."]),
            ("image", ("add-customer.jpg", "Example: customer record fields.")),
            ("h2", "Attach and retrieve files"),
            ("steps", ["Select the intended customer, then choose Attach Document.", "Choose a file smaller than 25 MB and give it a useful label.", "Confirm the label appears under the correct customer. Select it to open the file in its associated Windows application.", "Use document bundles, content search, or PDF annotations only for supported formats and limits. Search does not include image OCR, PDF OCR, or every spreadsheet format." ]),
            ("callout", ("Files and sync", "Customer attachments are stored locally with the workspace data. Customer synchronization does not transfer attachment files to another computer. Keep original documents and a separate copy of important files.", "amber")),
        ],
    },
    {
        "title": "6. Create appointments, quotes, and invoices",
        "parts": [
            ("steps", ["On Team Dashboard, open Create office work and choose appointment, quote, or invoice.", "Enter a clear title and select the correct customer. Add the date, amount, due date, and internal notes required by that record type.", "Select the create action and wait for a success or error message.", "Use Update and deliver work to find the saved record, change a supported status, or correct its customer assignment.", "For a quote or invoice PDF, use the relevant Create PDF action and note the saved file path." ]),
            ("table", [["Record", "Example status values", "Check separately"], ["Appointment", "Scheduled, Confirmed, Complete, Canceled", "Calendar invitation or customer notification delivery."], ["Quote", "Draft, Sent, Accepted, Declined", "Whether the quote was actually sent and accepted."], ["Invoice", "Open, Sent, Paid, Overdue", "Whether a payment processor confirmed payment."]], [1.18*inch, 2.2*inch, 2.95*inch]),
            ("image", ("create-quote.jpg", "Example: create-office-work controls.")),
        ],
    },
    {
        "title": "7. Tasks, workflows, reminders, and reports",
        "parts": [
            ("p", "Use Workflows and Automations for repeatable local work. A workflow template can create a next action; queued jobs may need an authorized user to process or retry them. Review a failed job before retrying so the same external action is not duplicated."),
            ("bullets", ["Work Planner: review task order, dependencies, estimates, capacity, and shift handoffs. Capacity figures depend on the entries supplied by your team.", "Reports: filter supported records and export local CSV summaries. Review the destination and contents before sharing.", "Growth & Work and Sales Studio: use boards and forecasts as planning aids. Estimates and forecasts are not guaranteed outcomes.", "Scheduling: create local appointments and planning records. Public booking and external calendar synchronization require separately configured services.", "Customer Management: review segments, duplicate alerts, history, and feedback. Review the records and take a backup before a local merge." ]),
            ("callout", ("Queued work may be local", "A reminder or job scheduled inside OverHead may run only while the application and relevant local services are available. Do not treat it as a guaranteed external email, text, calendar event, or payment unless the connected provider confirms it.", "blue")),
        ],
    },
    {
        "title": "8. Accounts, roles, plans, and integrations",
        "parts": [
            ("p", "An account's sign-in identity, application role, plan entitlement, and local data are related but separate. Ask the workspace owner to review the correct account and access when a section is locked."),
            ("table", [["Role", "Typical access"], ["Owner", "Workspace-wide administration and approvals."], ["Front Desk", "Customer follow-up and office operations as permitted by the workspace."], ["Bookkeeper", "Finance, invoices, expenses, and reporting as permitted."], ["Support", "Support workflows and assigned access; not automatic owner authority."]], [1.3*inch, 5.03*inch]),
            ("p", "Microsoft 365 and Square connectors require external account setup and the permissions displayed by the provider. Use the minimum permissions needed. Never place provider secrets, passwords, or payment credentials into notes or customer records. Some integration screens only import or export files and do not imply live synchronization."),
            ("p", "Desktop trial and Cylinder evaluation rules differ. Review Plans and Licenses for the entitlement assigned to this workspace. A trial screen is not evidence that a paid plan is active, and a saved test reference does not authorize a charge."),
        ],
    },
    {
        "title": "9. Privacy, security, and screen controls",
        "parts": [
            ("bullets", ["Privacy on/off masks selected sensitive fields on screen. It does not delete, encrypt a screenshot, or prevent someone from photographing the display.", "Lock the session when leaving the desk. Sign out or close the application when a shared computer will be unattended.", "Use Evidence and Security to review available local integrity, audit, session, privacy, and recovery information. A clean indicator is not a guarantee against every threat.", "Use role-limited accounts and avoid sharing credentials. Keep Windows, endpoint protection, and account recovery methods current.", "Open support bundles and exports yourself before sending them. They may include business or diagnostic information." ]),
            ("callout", ("Security boundary", "OverHead controls do not replace Windows account security, network/VPN controls, organizational policies, provider security, or independent backups. A program-level hash can show file differences; it does not prove publisher identity or prevent a determined person with device access from altering an unsigned build.", "amber")),
        ],
    },
    {
        "title": "10. Store, export, back up, and restore data",
        "parts": [
            ("p", "OverHead Desktop stores its local workspace under the current Windows account's OverHead data folder unless the Install Manager has configured a custom Desktop data root. Keep backups under access controls appropriate for customer information."),
            ("steps", ["Open Settings and find Local workspace health.", "Select Create Backup and wait for the verified path.", "Keep a protected copy on a different device or storage system. Preserve attached documents and generated files separately; a database backup may not include every file.", "For an export, choose a destination you control and inspect the contents before sharing.", "Before restoring, create a fresh backup. Choose the intended supported store file, select Validate Restore, and stop if validation fails.", "Only after confirming the target should you type the requested confirmation and select Restore. Sign in again and check expected records afterward." ]),
            ("image", ("backup-controls.jpg", "Example: local workspace health and backup controls.")),
            ("callout", ("Restore replaces local workspace data", "Restore is not a merge. Keep the safety copy and the original documents until you have verified the recovered workspace.", "amber")),
        ],
    },
    {
        "title": "11. Updates and troubleshooting",
        "parts": [
            ("p", "Desktop uses its Manager-led update workflow when packaged with the Manager companion. The app checks its product update source, shows release availability, and asks before starting the Manager update flow. The Manager verifies matching release metadata and installer hash, preserves user data, and checks the resulting installation according to that build's trust policy."),
            ("p", "Automatic checks are limited by the saved update schedule. Cylinder Server and Cylinder Client use their separate standalone updater feeds. Never install a Desktop installer over Cylinder or mix the product feeds."),
            ("table", [["Problem", "First checks"], ["Customer-only screen", "Return to staff sign-in and choose OverHead Team."], ["No work appears", "Confirm workspace, clear search, choose All, and check role/plan access."], ["Password or verification failure", "Check the email, use the newest message, and restart the recovery flow if its link expired."], ["File not found", "Use the saved path shown by OverHead and check Windows file association."], ["Sync or update failure", "Check network access, read the exact error, then retry after connectivity returns."], ["Restore warning", "Stop, confirm the source file and workspace, and preserve the current data before proceeding."]], [1.65*inch, 4.68*inch]),
            ("p", "For support, note the product, app version, Windows edition, page/action, exact error text, and the last successful step. Contact the published support address or website. Do not send passwords, recovery codes, payment credentials, or unredacted customer data."),
        ],
    },
    {
        "title": "12. A practical daily routine",
        "parts": [
            ("table", [["When", "Routine"], ["Start of day", "Confirm the workspace and role. Review current work, blocked items, appointments, open quotes, and invoices due."], ["After a customer contact", "Find or add the customer, create the correct record, write the next step, and attach only the necessary document."], ["Before sending an export", "Confirm the recipient, destination, file contents, and whether the file contains customer information."], ["End of day", "Confirm saved changes, mark completed work, record the next action, check sync status when used, and lock the session."], ["After important local changes", "Create a backup and preserve attachments separately."]], [1.35*inch, 4.98*inch]),
            ("callout", ("Keep the workflow small", "Start with one customer, one record, and one next action. Configure optional integrations only when a provider account and an authorized owner are ready.", "green")),
        ],
    },
]


CYLINDER_SECTIONS = [
    {
        "title": "1. Understand Server and Client roles",
        "parts": [
            ("p", "Cylinder is the department-managed OverHead capacity. It has two separate Windows packages: Cylinder Server, the department host, and Cylinder Client, the managed employee endpoint. Both share the core workspaces and local data behavior, but only the Server host exposes the department's central management controls."),
            ("table", [["Package", "Supported host", "Purpose"], ["Cylinder Server", "Windows Server or Windows IoT; Manager verifies the supported build and hardware rules.", "Department workspace and Rank/device policy control plane."], ["Cylinder Client", "Windows 10/11 managed workstation or remote desktop endpoint.", "Employee access to an approved Cylinder workspace; no department administration."], ["OverHead Desktop", "Regular Windows 10/11 workstation.", "Individual-user product; it is not a Cylinder workstation client."]], [1.27*inch, 2.55*inch, 2.51*inch]),
            ("callout", ("Do not confuse the roles", "Cylinder is a product access and device-policy layer. It does not configure native Windows Group Policy, Active Directory, Entra, a VPN, or firewall rules.", "amber")),
            ("p", "Cylinder Server, Cylinder Client, and Desktop have separate app identities, local data roots, and update feeds. The client is optional; not every organization needs to deploy it."),
        ],
    },
    {
        "title": "2. Plan the department deployment",
        "parts": [
            ("steps", ["Choose a supported Windows Server or Windows IoT host for Cylinder Server. Keep the host patched and protected by the organization's normal administrator controls.", "Choose managed Windows 10/11 endpoints or remote desktop endpoints for Cylinder Client.", "Decide who will be the verified workspace Owner and identify recovery access before inviting employees.", "Plan department names, employee Ranks, job functions, and the devices each employee may use.", "If remote users need access, configure the organization's approved VPN/network path and Windows administration controls separately. Cylinder does not provide or configure them.", "Keep a separate backup plan for local workspace data, customer attachments, and generated documents." ]),
            ("p", "The Manager performs Windows edition, architecture, memory, processor, storage, package-integrity, and signature-policy checks before installation/update. The supported package is x64; native ARM64 is not enabled. Server and Client compatibility requirements are different."),
            ("callout", ("Do not share a Server installer with workstation users", "Use the Cylinder Client package for endpoint workstations. The Server launcher should stop on a standard Windows workstation, and the Client launcher should stop on Server/IoT editions.", "blue")),
        ],
    },
    {
        "title": "3. Install, sign in, and connect a workspace",
        "parts": [
            ("steps", ["Open the OverHead Install Manager and choose the intended product: Cylinder Server for the compatible department host, or the optional Cylinder Client target for a managed Windows 10/11 workstation.", "Review the detected Windows edition, hardware, package-integrity, and publisher status. The Manager stops if the selected target is not compatible.", "For a first installation, read the Manager notices and select the explicit Yes, I agree option to continue. Selecting No, I do not agree cancels installation.", "When replacing an installed version, review the selected product and version. The Manager verifies a data backup, asks before removal, installs the matching package, and checks the installed version and data afterward.", "Open Cylinder Server and create the intended workspace or sign in to an existing workspace. Confirm the Owner account is the authorized workspace owner.", "Use the optional Cylinder Client on each supported workstation. A Server install can stage the client installer and deployment script if included in the package.", "Sign in to Cylinder Client with a verified employee account invited to the same workspace. Follow the device enrollment and authorization state displayed by the app.", "If the app reports Pending device or membership, ask an authorized Cylinder administrator to review it. Do not reuse another employee's credentials or device token." ]),
            ("p", "First Owner installation is allowed to bootstrap management. Further Owner installations and employee devices can begin Pending until an authorized Rank approves them. Device credentials are kept in the encrypted local store and can be revoked through device management; they are not hardware attestation."),
            ("p", "The Manager keeps Cylinder Server and Cylinder Client installation folders, release assets, and data paths separate. Uninstall keeps local data by default. Optional data removal requires its own choice and typed confirmation. The Manager displays a release date when an update is available; its window does not show a Manager version number."),
            ("callout", ("Customer portal is separate", "Cylinder Customer Access is not the employee sign-in path. Customer accounts do not become Cylinder employees and must not be used for staff administration.", "amber")),
        ],
    },
    {
        "title": "4. Manage employees, departments, and Ranks",
        "parts": [
            ("table", [["Rank", "Name", "Typical authority"], ["4", "Owner", "Workspace-wide employee, department, device, version/offline/pause policy, and audit controls."], ["3", "Administrator", "Manage lower ranks and devices/audit within assigned departments."], ["2", "Management", "Manage Rank 1 employees in overlapping departments."], ["1", "Regular User", "Use Cylinder as allowed by membership, job function, department, and device policy."]], [0.45*inch, 1.2*inch, 4.68*inch]),
            ("p", "A user's job function (such as Support, Front Desk, or Bookkeeper) is separate from their Cylinder Rank. Rank determines management authority; job function helps shape day-to-day work. No actor can assign or manage a rank equal to or higher than their own."),
            ("steps", ["Open Cylinder Management from the Server workspace using an authorized account.", "Invite employees using an existing active Firebase account or create a new invite as permitted by your Rank and department scope.", "Assign only the department and job function needed for the employee's work.", "Ask the employee to complete the email verification/account setup flow. A pending invite activates only after verified sign-in.", "Review the employee's device enrollment. Approve, block, or retire devices only within your authorized scope.", "Review the audit trail after consequential changes." ]),
            ("callout", ("Department scope boundary", "Department assignments limit Cylinder administration and device eligibility. They do not filter operational customer records or automatically synchronize files by department.", "amber")),
        ],
    },
    {
        "title": "5. Set workspace and device policies",
        "parts": [
            ("bullets", ["Minimum app version: an Owner can require employee ranks to use at least a chosen version. The Owner's recovery access is exempt so the workspace can be recovered.", "Offline grace: the Owner sets an offline access window from 0 to 24 hours; the default is four hours. Use an interval that matches the department's operational requirements.", "Workspace pause: an Owner can pause employee Ranks 1-3 while retaining Owner recovery access.", "Device approval: Rank 3 and Rank 4 administrators can approve, block, or retire devices within permitted departments. They can constrain which employees use a device.", "Revocation timing: account and device changes require a successful online policy check. A previously authorized session can continue offline until its configured grace expires." ]),
            ("callout", ("No general Windows policy engine", "Cylinder's policies protect access to OverHead. They do not create or deploy Group Policy Objects, manage Active Directory, enforce device encryption, configure VPN, or replace endpoint-management software.", "blue")),
        ],
    },
    {
        "title": "6. Use the shared office workflows",
        "parts": [
            ("p", "Cylinder uses the same core workspace patterns as Desktop: Team Dashboard, Customers, Workflows, appointments, quotes, invoices, documents, reports, scheduling, and supported integrations. Available actions depend on the user's Cylinder Rank, job function, membership, device authorization, and account access."),
            ("steps", ["Use Team Dashboard to review current work and record a clear next action.", "Add or select the intended customer before creating related appointments, quotes, or invoices.", "Review saved status and amounts separately from real-world events such as sending, accepting, or paying an invoice.", "Attach files to the intended customer. Keep original documents and a separate backup because attachments remain local.", "Use reports, exports, and support bundles only after reviewing the destination and contents." ]),
            ("image", ("dashboard.jpg", "Shared workspace example. This illustrative image is not a Cylinder control-plane view.")),
            ("p", "The standard Desktop plan checkout does not sell Cylinder. Cylinder uses its separate evaluation and entitlement path. Confirm current plan and deployment terms with the authorized owner before relying on paid features."),
        ],
    },
    {
        "title": "7. Know where Cylinder data lives",
        "parts": [
            ("table", [["Data", "Where it is used/stored", "What it does not mean"], ["Cylinder employee identity, membership, Rank, device policy", "Firebase-backed Cylinder control plane.", "Not a shared file server or Windows directory service."], ["Local customer records, work, attachments, PDFs", "On the Windows installation that created or stores the records.", "Not automatically copied from Server to Client or across departments."], ["Encrypted user/device credentials and caches", "Local encrypted application store.", "Not hardware attestation and not a complete central employee directory."], ["Backups/exports", "Local folders chosen by the user or Manager.", "Not a substitute for a separate off-device backup." ]], [1.8*inch, 2.15*inch, 2.38*inch]),
            ("p", "The central service checks the user's active membership, device status, department overlap, workspace policy, and current app version when online. Local operational records and customer documents do not automatically follow the employee to another endpoint."),
            ("steps", ["Create a verified local workspace backup from Settings before a risky operation or major change.", "Keep attachments and generated files in a separate protected backup plan.", "For restoration or migration, verify the intended host and data folder; a restore replaces local data rather than merging it.", "After restore, verify sample customers, tasks, attachments, and synchronization state separately." ]),
        ],
    },
    {
        "title": "8. Update and maintain Server and Client separately",
        "parts": [
            ("p", "Cylinder Server and Cylinder Client use separate installers and Firebase update feeds. Their automatic updates use the standalone Electron updater, not the OverHead Desktop Install Manager workflow. Automatic checks are scheduled and bounded; the app can fall back to a matching stable GitHub release if the Firebase feed is unavailable."),
            ("table", [["Variant", "Update feed"], ["Cylinder Server", "https://overhead-office.web.app/updates/cylinder/latest.yml"], ["Cylinder Client", "https://overhead-office.web.app/updates/cylinder-client/latest.yml"]], [1.6*inch, 4.73*inch]),
            ("p", "Keep the Server and Client on compatible release levels when the Owner sets a minimum version. Do not install the Desktop feed or installer on a Cylinder host. Review the release date, product name, version, and package trust status before updating."),
            ("callout", ("Update and consent", "Cylinder's standalone updater retains its product-specific update workflow. The separate Manager can install or remove supported products, but its product list and trust policy must match the package being managed.", "amber")),
        ],
    },
    {
        "title": "9. Back up, troubleshoot, and recover",
        "parts": [
            ("table", [["Issue", "What to check"], ["Employee cannot sign in", "Confirm verified Firebase account, active Cylinder membership, correct workspace, and invitation status."], ["Device is Pending or Blocked", "Ask an authorized Rank 3/4 administrator to review device enrollment and department scope."], ["Employee denied while offline", "Check connectivity and configured offline grace; do not bypass policy by sharing credentials."], ["Minimum version blocks access", "Update the correct Server/Client package from its matching feed."], ["Client/server edition mismatch", "Use Cylinder Server on compatible Server/IoT or Cylinder Client on a supported Windows 10/11 endpoint."], ["Missing customer record", "Confirm correct local installation and workspace; shared control-plane membership does not replicate local operational data."], ["Update failed", "Check network and product-specific feed; preserve data and logs before retrying." ]], [1.65*inch, 4.68*inch]),
            ("p", "Owners should protect the verified Owner account and enroll a second trusted Owner installation for recovery. There is no Rank 4 transfer or owner-recovery workflow described by the current product. If the only Owner identity becomes unavailable, use the documented support channel before attempting data or membership changes."),
            ("p", "For support, include product variant, version, Windows edition/build, workspace role, device status, exact error, and the last successful step. Do not send passwords, device credentials, recovery links, or unredacted customer information."),
        ],
    },
]


def make_story(title: str, subtitle: str, short_title: str, sections, images):
    styles = styles_for(short_title)
    story = []
    brand = Table([[Paragraph("OH", ParagraphStyle("Mark", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=colors.white, alignment=TA_CENTER))]], colWidths=[0.72*inch], rowHeights=[0.72*inch])
    brand.setStyle(TableStyle([("BACKGROUND", (0,0),(-1,-1),COPPER), ("BOX", (0,0),(-1,-1),0,NAVY), ("VALIGN", (0,0),(-1,-1),"MIDDLE")]))
    story += [Spacer(1, 1.1*inch), brand, Spacer(1, 0.44*inch),
              paragraph(short_title.upper(), styles["cover_tag"]),
              paragraph(title, styles["cover_title"]),
              paragraph(subtitle, styles["cover_subtitle"]),
              Spacer(1, 0.2*inch),
              paragraph(f"Release {VERSION}  |  Updated {TODAY}", styles["cover_meta"]),
              paragraph("Practical instructions for setup, daily work, data handling, updates, and recovery.", styles["cover_note"]),
              Spacer(1, 1.1*inch),
              callout("Read this first", "Product behavior and available controls vary by edition, Windows compatibility, account role, plan, and connected services. This guide explains current product workflows; it is not legal, accounting, or security advice.", 6.33*inch, "blue", styles),
              Spacer(1, 0.2*inch),
              paragraph("Use the table of contents to find a task. Read the data and security boundaries before moving, exporting, restoring, or sharing records.", styles["cover_note"]),
              PageBreak(), paragraph("Contents", styles["toc_title"])]
    toc = TableOfContents()
    toc.levelStyles = [styles["toc1"]]
    story += [toc, PageBreak()]
    for section in sections:
        story.append(paragraph(section["title"], styles["h1"]))
        for part in section["parts"]:
            kind, value = part[0], part[1]
            if kind == "h2":
                story.append(paragraph(value, styles["h2"]))
            elif kind == "p":
                story.append(paragraph(value, styles["body"]))
            elif kind == "bullets":
                story.extend(bullets(value, styles["bullet"]))
            elif kind == "steps":
                story.extend(steps(value, styles["bullet"]))
            elif kind == "table":
                widths = part[2] if len(part) > 2 else [6.33*inch/len(value[0])]*len(value[0])
                story.append(data_table(value, widths, styles))
            elif kind == "callout":
                story.append(callout(value[0], value[1], 6.33*inch, value[2], styles))
            elif kind == "image":
                filename, caption = value
                flow = Image(str(images / filename))
                flow._restrictSize(6.25*inch, 3.45*inch)
                flow.hAlign = "CENTER"
                story.extend([Spacer(1, 4), flow, paragraph(caption, styles["caption"])])
        story.append(Spacer(1, 5))
    return story


def build(path: Path, title: str, subtitle: str, short_title: str, sections):
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = GuideDoc(path, title, short_title)
    doc.multiBuild(make_story(title, subtitle, short_title, sections, SCREENSHOTS))


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    build(OUTPUT / "OverHead-Desktop-User-Guide.pdf",
          "OverHead Desktop User Guide",
          "A hands-on guide for a local-first Windows office workspace.",
          "Desktop user guide", DESKTOP_SECTIONS)
    build(OUTPUT / "OverHead-Cylinder-User-Guide.pdf",
          "OverHead Cylinder User Guide",
          "A practical guide for Cylinder Server administrators and workstation users.",
          "Cylinder user guide", CYLINDER_SECTIONS)
    print(f"Created {OUTPUT / 'OverHead-Desktop-User-Guide.pdf'}")
    print(f"Created {OUTPUT / 'OverHead-Cylinder-User-Guide.pdf'}")
