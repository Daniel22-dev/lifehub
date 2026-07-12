export function nextPaymentDueDate(dateValue, frequency) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ''));
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  if (Number.isNaN(date.getTime())) return '';
  const originalDay = date.getDate();
  if (frequency === 'monthly') date.setMonth(date.getMonth() + 1, 1);
  else if (frequency === 'quarterly') date.setMonth(date.getMonth() + 3, 1);
  else if (frequency === 'yearly') date.setFullYear(date.getFullYear() + 1, date.getMonth(), 1);
  else return String(dateValue);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDay));
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function advanceAutomaticPayment(payment, todayValue){
  const source=payment && typeof payment==='object' ? payment : {};
  const clone={...source,paymentHistory:Array.isArray(source.paymentHistory)?[...source.paymentHistory]:[]};
  const amount=Math.max(0,Number(source.amount)||0);
  const dueDate=String(source.dueDate||'');
  const today=String(todayValue||'');
  const automatic=source.automatic===true;
  if(!automatic || !(amount>0) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)){
    return {changed:false,payment:clone,occurrences:[]};
  }
  if(source.status==='paid' && source.frequency==='once') return {changed:false,payment:clone,occurrences:[]};
  if(dueDate>today) return {changed:false,payment:clone,occurrences:[]};

  const occurrences=[];
  if(source.frequency==='once'){
    occurrences.push({date:dueDate,amount});
    clone.status='paid';
    clone.lastPaidAt=dueDate;
    return {changed:true,payment:clone,occurrences};
  }

  if(!['monthly','quarterly','yearly'].includes(source.frequency)){
    return {changed:false,payment:clone,occurrences:[]};
  }

  let cursor=dueDate;
  let guard=0;
  while(cursor<=today && guard<120){
    occurrences.push({date:cursor,amount});
    const next=nextPaymentDueDate(cursor,source.frequency);
    if(!next || next===cursor) break;
    cursor=next;
    guard++;
  }
  if(!occurrences.length) return {changed:false,payment:clone,occurrences:[]};
  clone.dueDate=cursor;
  clone.status='pending';
  clone.lastPaidAt=occurrences[occurrences.length-1].date;
  return {changed:true,payment:clone,occurrences};
}
