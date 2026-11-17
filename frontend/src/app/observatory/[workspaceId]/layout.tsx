import React from "react";
import { WorkspaceNav } from "@/components/shared/WorkspaceNav";

export default function ObservatoryWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}) {
  return (
    <div>
      <WorkspaceNav workspaceId={params.workspaceId} />
      {children}
    </div>
  );
}
