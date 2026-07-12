export class SaveLifecycle {
  constructor(){ this.reset(); }
  reset(){ this.dirty=false; this.pending=false; this.error=null; this.lastSavedAt=''; }
  markDirty(){ this.dirty=true; this.error=null; }
  begin(){ this.pending=true; }
  succeed(savedAt=new Date().toISOString()){ this.pending=false; this.dirty=false; this.error=null; this.lastSavedAt=savedAt; }
  fail(error){ this.pending=false; this.dirty=true; this.error=error instanceof Error ? error : new Error(String(error || 'Uložení selhalo.')); }
  get blocksSafeLock(){ return this.pending || this.dirty || !!this.error; }
}
