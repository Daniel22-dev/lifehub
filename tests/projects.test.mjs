import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectAttachmentMetadata,
  projectBudgetByCategory,
  projectCostPlanned,
  projectStatusProgress,
  summarizeProjectBudget
} from '../src/features/projects.js';

test('rozpočet projektu počítá plán, skutečnost a překročení', () => {
  const project={budgetTarget:100000,costs:[
    {category:'material',quantity:10,unitPrice:4000,actual:42000,status:'paid'},
    {category:'work',quantity:5,unitPrice:6000,actual:28000,status:'ordered'},
    {category:'material',quantity:1,unitPrice:5000,actual:0,status:'estimate'}
  ]};
  assert.equal(projectCostPlanned(project.costs[0]),40000);
  assert.deepEqual(summarizeProjectBudget(project),{
    target:100000,planned:75000,actual:70000,committed:70000,remaining:30000,overrun:0,reference:100000
  });
  const groups=projectBudgetByCategory(project);
  assert.deepEqual(groups.find(group=>group.category==='material'),{category:'material',planned:45000,actual:42000});
});

test('bez cílového rozpočtu se porovnává proti součtu plánu', () => {
  const result=summarizeProjectBudget({costs:[{quantity:2,unitPrice:500,actual:1300,status:'paid'}]});
  assert.equal(result.reference,1000);
  assert.equal(result.overrun,300);
});

test('stav projektu má stabilní postup', () => {
  assert.equal(projectStatusProgress('idea'),8);
  assert.equal(projectStatusProgress('realization'),72);
  assert.equal(projectStatusProgress('done'),100);
  assert.equal(projectStatusProgress('unknown'),0);
});

test('metadata příloh zachová vazbu na projekt a vynechá chybějící soubory', () => {
  const files=projectAttachmentMetadata([{id:'p1',title:'Přístřešek',attachments:[
    {id:'f1',fileName:'nacrt.png',storedFile:true},
    {id:'f2',fileName:'stary.pdf',storedFile:false}
  ]}]);
  assert.equal(files.length,1);
  assert.equal(files[0].projectId,'p1');
  assert.equal(files[0].projectTitle,'Přístřešek');
});
