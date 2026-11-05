import "./globals.css";

export const metadata = {
  title: "Plugz Account Dashboard",
  description: "Your Plugz orders, saved pieces, and account preferences.",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
