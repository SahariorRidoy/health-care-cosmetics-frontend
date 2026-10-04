import { redirect } from 'next/navigation';

export default function CustomerDetailRedirect() {
  redirect('/sales/dealers');
}
