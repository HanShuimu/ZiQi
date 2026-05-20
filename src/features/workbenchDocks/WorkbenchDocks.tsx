import type { ProjectSummary } from "../../core/project/types";
import { ListItem, Panel, Tabs } from "../../ui";

export interface WorkbenchDocksProps {
  project: ProjectSummary;
}

export function WorkbenchDocks({ project }: WorkbenchDocksProps) {
  return (
    <>
      <Tabs className="panel">
        <span className="active">Analysis</span>
        <span>Stems</span>
        <span>Notes</span>
        <span>Compare</span>
        <span>Hidden</span>
      </Tabs>

      <div className="dock-grid">
        <Panel>
          <div className="section-label">Analysis</div>
          {project.analysisRuns.map((run) => (
            <ListItem key={run.id}>
              <strong>{run.name}</strong>
              <span>{run.status}</span>
            </ListItem>
          ))}
        </Panel>

        <Panel>
          <div className="section-label">Stems</div>
          <ListItem>
            <strong>Local Demucs Slot</strong>
            <span>pending</span>
          </ListItem>
          <ListItem>
            <strong>Remote API Slot</strong>
            <span>pending</span>
          </ListItem>
        </Panel>

        <Panel>
          <div className="section-label">Session Notes</div>
          <p className="panel-copy">
            This dock will later host markers, saved viewpoints, and quick
            comparison notes without replacing the raw spectrum workspace.
          </p>
        </Panel>
      </div>
    </>
  );
}
