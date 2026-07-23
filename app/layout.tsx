import './globals.css';
export const metadata={
 metadataBase:new URL('https://trading-core-crm-v2.vercel.app'),
 title:'CRM',
 description:'CRM',
 openGraph:{title:'CRM',description:'CRM',type:'website'},
 twitter:{card:'summary',title:'CRM',description:'CRM'}
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
