# Timmy Advanced Configuration Examples

These are reference examples for common Timmy configurations. They are not
presets, are not imported by the app, and contain no broker credentials.

Most users should use Timmy's native `Setup` tab for Webull keys, account checks,
and saving the local profile. The app requires profile verification before save.
The saved local profile can override broker-profile settings from environment
files. Review the variables against the installed version before making manual
environment changes. The Live example starts in Paper with live order submission
and market-open auto-start disabled.

## Files

- `paper-desk.env.example`: paper-first setup for testing the market desk.
- `live-preparation.env.example`: Live preparation example, with live switches off.
- `runtime-reliability.env.example`: watchdog, safe mode, and health settings.
