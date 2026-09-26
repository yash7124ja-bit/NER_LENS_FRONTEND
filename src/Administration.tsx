import { useEffect, useState, type FormEvent } from "react";
import { ApiError, request, type Session } from "./api";
import { permittedWorkspaces, workspaceFromPath } from "./workspace";
type User = { actor_id: string; email: string; display_name: string; roles: string[]; status_authority: boolean; active: boolean };
type Vehicle = { vehicle_id: string; alias: string; profile: string; active: boolean };
type Story = { id: string; title: string; role: string; story: string; acceptance: string[]; status: string; evidence: string };
const workflows:Record<string,[string,string]> = {
  "SIH-01":["#segments","Inspect road conditions"],"SIH-02":["/field/#field-reports","Capture a field report"],
  "SIH-03":["/authority/#operations:reports","Review evidence"],"SIH-04":["/authority/#operations:status","Publish a road decision"],
  "SIH-05":["/control/#operations:routes","Plan a route"],"SIH-06":["/control/#operations:missions","Manage deliveries"],
  "SIH-07":["/field/#operations:missions","Share mission location"],"SIH-08":["/authority/#administration","Manage access"],
  "SIH-09":["/field/#field-reports","Attach report photos"],"SIH-11":["/control/#model-readiness","Inspect model readiness"]
};
const roles = [["regional_viewer","Regional viewer"],["field_reporter","Field reporter"],["reviewer","Evidence reviewer"],["dispatcher","Dispatcher"],["driver","Driver"],["district_officer","District officer"],["system_admin","Super Admin"]];
function RoleFields({ user }: { user?: User }) { return <><fieldset className="role-options"><legend>Roles in this corridor</legend>{roles.map(([value,label]) => <label key={value}><input type="checkbox" name="roles" value={value} defaultChecked={user ? user.roles.includes(value) : value === "regional_viewer"} />{label}</label>)}</fieldset><label className="consent"><input type="checkbox" name="authority" defaultChecked={user?.status_authority} /> Grant status authority (requires District officer role)</label></>; }
export default function Administration({ session, corridorId, manageUsers }: { session: Session; corridorId: string; manageUsers: boolean }) {
  const admin = manageUsers && session.user.roles.includes("system_admin");
  const canReadStories = session.user.roles.some(role => ["regional_viewer", "dispatcher", "reviewer", "district_officer", "field_reporter"].includes(role));
  const [users,setUsers]=useState<User[]>([]),[vehicles,setVehicles]=useState<Vehicle[]>([]),[stories,setStories]=useState<Story[]>([]);
  const [error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  const [filter,setFilter]=useState("");
  const [index,setIndex]=useState("not_configured"),[results,setResults]=useState<Story[]|null>(null),[searchNote,setSearchNote]=useState("");
  useEffect(() => { const c=new AbortController();
    if(canReadStories) request<{stories:Story[];vector_index:string}>(`/v1/user-stories?corridor_id=${encodeURIComponent(corridorId)}`,c.signal).then(r=>{setStories(r.stories);setIndex(r.vector_index);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});
    if(admin) request<{users:User[]}>(`/v1/admin/users?corridor_id=${encodeURIComponent(corridorId)}`,c.signal).then(r=>setUsers(r.users)).catch(e=>{if(!c.signal.aborted)setError(e.message);});
    if(admin) request<{vehicles:Vehicle[]}>(`/v1/admin/vehicles?corridor_id=${encodeURIComponent(corridorId)}`,c.signal).then(r=>setVehicles(r.vehicles)).catch(e=>{if(!c.signal.aborted)setError(e.message);});
    return ()=>c.abort();
  },[corridorId,admin,canReadStories,revision]);
  async function searchIndex(reindex=false){setBusy(true);setError("");setSearchNote("");
    try { if(reindex){const result=await request<{indexed:number}>(`/v1/admin/user-stories/reindex?corridor_id=${encodeURIComponent(corridorId)}`,undefined,{});setSearchNote(`${result.indexed} stories indexed in Weaviate.`);}
      else {if(!filter.trim())throw Error("Enter a search term.");const result=await request<{stories:Story[]}>(`/v1/user-stories/search?corridor_id=${encodeURIComponent(corridorId)}&q=${encodeURIComponent(filter.trim())}`);setResults(result.stories);setSearchNote(`${result.stories.length} results from Weaviate keyword search.`);}
    }catch(e){setError(e instanceof Error?e.message:"Story search is unavailable. The database list remains available.");}finally{setBusy(false);}
  }
  async function save(e:FormEvent<HTMLFormElement>,user?:User){e.preventDefault();const form=e.currentTarget,d=new FormData(form);setBusy(true);setError("");setMessage("");
    try {const body:Record<string,unknown>={corridor_id:corridorId,roles:d.getAll("roles"),status_authority:d.get("authority")==="on"};
      if(!Array.isArray(body.roles)||!body.roles.length)throw Error("Select at least one role.");
      if(body.status_authority&&!body.roles.includes("district_officer"))throw Error("Status authority requires the District officer role.");
      if(!user)Object.assign(body,{display_name:d.get("name"),email:d.get("email"),password:d.get("password")});
      const r=await fetch(user?`/v1/admin/users/${user.actor_id}/roles`:"/v1/admin/users",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
      if(!r.ok)throw await ApiError.fromResponse(r);
      if(!user)form.reset();setRevision(v=>v+1);setMessage(user?"Roles saved. The user should sign in again to refresh available controls.":"Account created. Share its credentials privately with the intended user.");
    }catch(e){setError(e instanceof Error?e.message:"Could not save account.");}finally{setBusy(false);}
  }
  async function saveVehicle(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget,d=new FormData(form);setBusy(true);setError("");setMessage("");
    try{await request("/v1/admin/vehicles",undefined,{corridor_id:corridorId,alias:d.get("alias"),profile:d.get("profile")});form.reset();setRevision(v=>v+1);setMessage("Vehicle alias added for this corridor. Dispatchers can now select it.");}
    catch(e){setError(e instanceof Error?e.message:"Could not add vehicle.");}finally{setBusy(false);}
  }
  return <>
    {admin&&<section id="administration" className="card"><header className="card-hd"><div><p className="eyebrow">SUPER ADMIN</p><h2>People & access</h2><p>Roles apply only to this corridor. Administrator access does not automatically grant road-status authority.</p></div></header><div className="card-bd">
      {message&&<p role="status" className="workflow-success">{message}</p>}{error&&<p role="alert" className="notice error">{error}</p>}
      <details><summary>Create a user</summary><form className="workflow-form" onSubmit={e=>void save(e)}><div className="form-grid"><label>Display name<input name="name" required maxLength={255}/></label><label>Email<input name="email" type="email" required maxLength={254}/></label><label>Initial password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required/></label></div><RoleFields/><button disabled={busy}>Create user</button></form></details>
      {!users.length&&<p className="workflow-empty">No accounts loaded for this corridor.</p>}{users.map(user=><details className="user-access-row" key={user.actor_id}><summary>{user.display_name} · {user.email}<span className="status-tag">{user.roles.map(r=>roles.find(([id])=>id===r)?.[1]??r).join(" / ")}</span></summary><form className="workflow-form" onSubmit={e=>void save(e,user)}><RoleFields user={user}/>{user.actor_id===session.user.actor_id&&<p className="help">This is your account. Keep Super Admin selected; sign in again after changing your operational roles.</p>}<button disabled={busy}>Save roles</button></form></details>)}
      <h3>Fleet aliases</h3><p className="help">Use internal aliases, not registration numbers. The alias and vehicle profile are limited to this corridor.</p>
      <form className="workflow-form" onSubmit={e=>void saveVehicle(e)}><div className="form-grid"><label>Vehicle alias<input name="alias" required maxLength={64}/></label><label>Vehicle profile<select name="profile"><option value="light_goods">Light goods</option><option value="rigid_truck">Rigid truck</option><option value="emergency">Emergency</option></select></label></div><button disabled={busy}>Add vehicle</button></form>
      {vehicles.length ? <ul>{vehicles.map(vehicle=><li key={vehicle.vehicle_id}>{vehicle.alias} · {vehicle.profile.replaceAll("_"," ")}{!vehicle.active&&" · inactive"}</li>)}</ul> : <p className="help">No vehicles registered for this corridor yet.</p>}
    </div></section>}
    {canReadStories && <section id="user-stories" className="card"><header className="card-hd"><div><h2>SIH user stories & readiness</h2><p>Persisted acceptance criteria. “Verified in replay” does not mean validated in the field.</p></div></header><div className="card-bd">
      {!admin&&error&&<p role="alert">{error}</p>}<label>Find a user story<input value={filter} onChange={e=>{setFilter(e.target.value);setResults(null);setSearchNote("");}} placeholder="Search role, workflow or acceptance criteria"/></label>
      <p className="help">Source of record: application database · {index === "configured" ? "Weaviate keyword index configured. Semantic embeddings are not enabled." : "Weaviate is not configured; local text filtering is available."}</p><div className="workspace-nav"><button disabled={busy || index !== "configured" || !filter.trim()} onClick={()=>void searchIndex()}>Search Weaviate</button>{admin && <button disabled={busy || index !== "configured"} onClick={()=>void searchIndex(true)}>Reindex stories</button>}{results && <button onClick={()=>{setResults(null);setFilter("");setSearchNote("");}}>Show all stories</button>}</div>{searchNote && <p role="status">{searchNote}</p>}{error && <p role="alert" className="notice error">{error}</p>}
      {(results ?? stories.filter(s=>JSON.stringify(s).toLowerCase().includes(filter.toLowerCase()))).map(s=>{const route=workflows[s.id];const target=route&&workspaceFromPath(new URL(route[0],window.location.href).pathname);const canOpen=route&&(!target||permittedWorkspaces(session.user.roles).includes(target));return <details className="story-row" key={s.id}><summary><span className="mono">{s.id}</span> {s.title}<span className={`status-tag story-${s.status}`}>{s.status.replaceAll("_"," ")}</span></summary><p>{s.story}</p>{route&&(canOpen?<a className="text-button" href={route[0]}>{route[1]} →</a>:<p className="help">{route[1]} requires access to NER LENS {target}.</p>)}<ul>{s.acceptance.map(a=><li key={a}>{a}</li>)}</ul><p className="help"><strong>Evidence / remaining work:</strong> {s.evidence}</p></details>})}
      {!stories.length&&<p className="workflow-empty">No user stories have been ingested yet.</p>}
    </div></section>}
  </>;
}
