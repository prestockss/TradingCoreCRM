import AuthApp from '@/components/AuthApp';

export const metadata={
 title:'CRM',
 description:'CRM',
 openGraph:{title:'CRM',description:'CRM',type:'website'},
 twitter:{card:'summary',title:'CRM',description:'CRM'}
};

export default function CrmPage(){
 return <AuthApp initial={[]}/>;
}
