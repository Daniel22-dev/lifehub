const STATUS_PROGRESS = Object.freeze({idea:8,research:22,planning:42,realization:72,paused:50,done:100});

export const PROJECT_STATUS_LABELS = Object.freeze({
  idea:'💡 Nápad',
  research:'🔎 Průzkum',
  planning:'📐 Plánování',
  realization:'🏗️ Realizace',
  paused:'⏸ Pozastaveno',
  done:'✅ Dokončeno'
});

export const PROJECT_AREA_LABELS = Object.freeze({
  house:'🏠 Dům a interiér',
  exterior:'🧱 Exteriér',
  garden:'🌿 Zahrada',
  technology:'⚙️ Technologie',
  other:'📌 Jiné'
});

export const PROJECT_COST_CATEGORY_LABELS = Object.freeze({
  material:'Materiál',
  work:'Práce',
  technology:'Technologie',
  transport:'Doprava',
  documentation:'Projekt / povolení',
  reserve:'Rezerva',
  other:'Jiné'
});

export function projectStatusProgress(status){
  return STATUS_PROGRESS[status] ?? 0;
}

export function projectCostPlanned(cost){
  const quantity=Math.max(0,Number(cost?.quantity)||0);
  const unitPrice=Math.max(0,Number(cost?.unitPrice)||0);
  return quantity*unitPrice;
}

export function summarizeProjectBudget(project){
  const costs=Array.isArray(project?.costs)?project.costs:[];
  const target=Math.max(0,Number(project?.budgetTarget)||0);
  const planned=costs.reduce((sum,cost)=>sum+projectCostPlanned(cost),0);
  const actual=costs.reduce((sum,cost)=>sum+Math.max(0,Number(cost?.actual)||0),0);
  const committed=costs.filter(cost=>['ordered','paid'].includes(cost?.status)).reduce((sum,cost)=>sum+(Math.max(0,Number(cost?.actual)||0)||projectCostPlanned(cost)),0);
  const reference=target||planned;
  const remaining=Math.max(0,reference-actual);
  const overrun=Math.max(0,actual-reference);
  return {target,planned,actual,committed,remaining,overrun,reference};
}

export function projectBudgetByCategory(project){
  const groups={};
  for(const cost of Array.isArray(project?.costs)?project.costs:[]){
    const category=Object.prototype.hasOwnProperty.call(PROJECT_COST_CATEGORY_LABELS,cost?.category)?cost.category:'other';
    groups[category]??={category,planned:0,actual:0};
    groups[category].planned+=projectCostPlanned(cost);
    groups[category].actual+=Math.max(0,Number(cost?.actual)||0);
  }
  return Object.values(groups).sort((a,b)=>Math.max(b.planned,b.actual)-Math.max(a.planned,a.actual));
}

export function projectAttachmentMetadata(projects){
  const out=[];
  for(const project of Array.isArray(projects)?projects:[]){
    for(const attachment of Array.isArray(project?.attachments)?project.attachments:[]){
      if(attachment?.storedFile!==false && attachment?.id) out.push({...attachment,projectId:project.id,projectTitle:project.title});
    }
  }
  return out;
}
