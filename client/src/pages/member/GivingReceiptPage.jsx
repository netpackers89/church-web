import { Printer, Receipt } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { userService } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../../components/ui/Button.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';

function money(amount, currency) {
  const value = Number(amount);
  return `${currency || 'ETB'} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`;
}

export default function GivingReceiptPage() {
  const { id } = useParams();
  const receipt = useAsync(async () => {
    const response = await userService.myReceipt(id);
    return response.data?.data;
  }, [id]);

  if (receipt.loading) return <div className="container" style={{ paddingBlock: '3rem' }}><div className="card skeleton" style={{ height: '22rem' }} /></div>;
  if (receipt.error) return <div className="container" style={{ paddingBlock: '3rem' }}><ErrorMessage error={receipt.error} title="Receipt is unavailable" /></div>;

  const data = receipt.data;
  return (
    <main className="container giving-receipt-page">
      <div className="row-between giving-receipt-actions"><span className="eyebrow blue"><Receipt size={15} /> Confirmed contribution receipt</span><Button variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()}>Print receipt</Button></div>
      <article className="card giving-receipt">
        <header><h1>{data.church.churchName}</h1><p>{data.church.address}</p><p>{data.church.contactEmail}</p></header>
        <div className="giving-receipt-confirmed">VERIFIED CONTRIBUTION</div>
        <h2>Contribution receipt</h2>
        <dl>
          <div><dt>Receipt number</dt><dd>{data.receiptNumber}</dd></div>
          <div><dt>Contributor</dt><dd>{data.member}</dd></div>
          <div><dt>Giving category</dt><dd>{data.category}</dd></div>
          <div><dt>Payment reference</dt><dd>{data.reference}</dd></div>
          <div><dt>Approved</dt><dd>{new Date(data.confirmedAt).toLocaleString()}</dd></div>
        </dl>
        <strong className="giving-receipt-amount">{money(data.amount, data.currency)}</strong>
        <p className="muted">This receipt is available because an authorized finance reviewer approved the transaction.</p>
      </article>
    </main>
  );
}
