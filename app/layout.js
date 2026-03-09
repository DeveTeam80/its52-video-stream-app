import "./globals.css";

export const metadata = {
  title: "IDARATUT TA'REEF AL SHAKHSI",
  description: "Simple Auth Application",
  icons: {
    icon: "/taiyebi-mohalla-pune.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css?family=Alice|Source+Sans+Pro|Material+Icons&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://www.its52.com/css/1443/login.min.css?ver=5300"
        />
        <link
          rel="stylesheet"
          href="https://www.its52.com/jscommon/jquery/jquery-ui-1.10.3.custom.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
