# Developer editor workflow

OverHead includes an owner-only **Developer hot-fix workspace** control under **Settings**. It is for a developer who needs to inspect or change the local OverHead source code. It is additionally gated by a freshly verified OverHead staff sign-in: the signed-in owner must use an official OverHead Team address and have an active, unexpired Management or Administrator employee license. The tool never requests or stores a second raw password.

1. Install Visual Studio Code, Code - OSS, or VSCodium on the Windows device.
2. Sign in again as the OverHead owner using the verified official OverHead Team account. Confirm that account has an active Management or Administrator employee license, then open **Settings**.
3. Under **Developer hot-fix workspace**, select **Choose Source Folder** and choose the OverHead repository root. The folder must contain `package.json`, `electron-main.cjs`, `electron-backend.cjs`, and `src`.
4. Select **Auto**, **Visual Studio Code**, or **Code - OSS / VSCodium**.
5. Select **Open In Code Editor**.

The launcher detects standard Windows installs and the `code`, `code-oss`, and `codium` PATH commands. It opens only the validated source folder; it never opens customer records, the protected app-data folder, backups, exports, or support bundles. Each configuration change and editor launch is written to the local audit log.

The control is intentionally unavailable to managers, staff, and customers. It opens source code only; it does not bypass source review, build checks, signing, packaging, or release validation.
