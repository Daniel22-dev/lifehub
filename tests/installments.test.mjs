import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDueInstallmentPayments, calculateRegularInstallmentPayment } from '../src/features/installments.js';

test('poslední pravidelná splátka se zastropuje na zbývající dluh', () => {
  assert.deepEqual(calculateRegularInstallmentPayment({total:10000,paid:9900,monthly:1000}),{
    appliedAmount:100,newPaid:10000,remainingBefore:100,remainingAfter:0,completed:true
  });
});

test('nulová nebo již doplacená splátka nic nezapíše', () => {
  assert.equal(calculateRegularInstallmentPayment({total:10000,paid:10000,monthly:1000}).appliedAmount,0);
  assert.equal(calculateRegularInstallmentPayment({total:10000,paid:5000,monthly:0}).appliedAmount,0);
});

test('po dni splatnosti se automaticky připraví běžná měsíční splátka', () => {
  const result=calculateDueInstallmentPayments({
    total:120000,paid:0,monthly:10000,startMonth:'2026-07',dueDay:15,paymentHistory:[]
  },{today:'2026-07-17'});
  assert.deepEqual(result.entries,[{date:'2026-07-15',amount:10000}]);
  assert.equal(result.newPaid,10000);
});

test('před dnem splatnosti se dluh automaticky nesnižuje', () => {
  const result=calculateDueInstallmentPayments({
    total:120000,paid:0,monthly:10000,startMonth:'2026-07',dueDay:15,paymentHistory:[]
  },{today:'2026-07-14'});
  assert.equal(result.appliedAmount,0);
});

test('automatické zpracování je idempotentní a neodečte stejný měsíc dvakrát', () => {
  const result=calculateDueInstallmentPayments({
    total:120000,paid:10000,monthly:10000,startMonth:'2026-07',dueDay:15,
    paymentHistory:[{date:'2026-07-15',amount:10000,type:'regular',automatic:true}]
  },{today:'2026-07-17'});
  assert.equal(result.appliedAmount,0);
});

test('mimořádná splátka nenahrazuje běžnou splátku daného měsíce', () => {
  const result=calculateDueInstallmentPayments({
    total:120000,paid:20000,monthly:10000,startMonth:'2026-07',dueDay:15,
    paymentHistory:[{date:'2026-07-10',amount:20000,type:'extra'}]
  },{today:'2026-07-17'});
  assert.deepEqual(result.entries,[{date:'2026-07-15',amount:10000}]);
  assert.equal(result.newPaid,30000);
});

test('den 31 se v kratším měsíci posune na poslední kalendářní den', () => {
  const result=calculateDueInstallmentPayments({
    total:20000,paid:0,monthly:10000,startMonth:'2026-02',dueDay:31,paymentHistory:[]
  },{today:'2026-02-28'});
  assert.deepEqual(result.entries,[{date:'2026-02-28',amount:10000}]);
});

test('již splacená částka může být výchozím stavem před novým automatickým kalendářem', () => {
  const result=calculateDueInstallmentPayments({
    total:120000,paid:50000,monthly:10000,startMonth:'2026-07',dueDay:15,
    autoPaidBaseline:50000,autoExtraBaseline:0,paymentHistory:[]
  },{today:'2026-07-17'});
  assert.deepEqual(result.entries,[{date:'2026-07-15',amount:10000}]);
  assert.equal(result.newPaid,60000);
});

test('resetovaný kalendář s budoucím začátkem se neuzavře znovu podle starých termínů', () => {
  const result=calculateDueInstallmentPayments({
    total:120000,paid:110000,monthly:10000,startMonth:'2026-08',dueDay:15,
    autoPaidBaseline:110000,autoExtraBaseline:0,paymentHistory:[]
  },{today:'2026-07-17'});
  assert.equal(result.appliedAmount,0);
});
