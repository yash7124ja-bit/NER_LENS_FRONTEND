export type Workspace = "control" | "authority" | "field";

export const workspaces: Record<Workspace, { name: string; roles: string[]; description: string }> = {
  control: {
    name: "Control",
    roles: ["dispatcher", "regional_viewer"],
    description: "Plan deliveries and inspect corridor conditions.",
  },
  authority: {
    name: "Authority",
    roles: ["reviewer", "district_officer", "system_admin"],
    description: "Review evidence, publish decisions, and manage access.",
  },
  field: {
    name: "Field",
    roles: ["field_reporter", "driver"],
    description: "Capture observations, follow assigned missions, and acknowledge alerts.",
  },
};

export function workspaceFromPath(path: string): Workspace | null {
  const first = path.split("/").filter(Boolean)[0];
  return first === "control" || first === "authority" || first === "field" ? first : null;
}

export function permittedWorkspaces(roles: string[]): Workspace[] {
  return (Object.keys(workspaces) as Workspace[]).filter(id =>
    workspaces[id].roles.some(role => roles.includes(role)));
}
