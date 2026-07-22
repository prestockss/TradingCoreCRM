import AuthApp from '@/components/AuthApp';
import seed from '@/data/customers.json';
import type {Customer} from '@/lib/types';
export default function Page(){return <AuthApp initial={seed as Customer[]}/>}
