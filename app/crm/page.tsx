import AuthApp from '@/components/AuthApp';

const previewDescription='CRM\u200B';

export const metadata={
 title:'CRM',
 description:previewDescription,
 applicationName:'CRM',
 alternates:{canonical:'/crm'},
 openGraph:{
  title:'CRM',
  description:previewDescription,
  siteName:'CRM',
  url:'/crm',
  locale:'ko_KR',
  type:'website'
 },
 twitter:{card:'summary_large_image',title:'CRM',description:previewDescription}
};

export default function CrmPage(){
 return <AuthApp initial={[]}/>;
}
