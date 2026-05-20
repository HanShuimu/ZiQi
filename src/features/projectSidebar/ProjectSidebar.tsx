import type { ProjectSummary } from "../../core/project/types";
import { ListItem, Panel } from "../../ui";

export interface ProjectSidebarProps {
  project: ProjectSummary;
}

export function ProjectSidebar({ project }: ProjectSidebarProps) {
  return (
    <Panel className="left-rail">
      <section>
        <div className="section-label">Project</div>
        <h2>{project.name}</h2>
        <p>{project.sourceAudio.name}</p>
        <p>{project.sourceAudio.channelCount} channels</p>
      </section>

      <section>
        <div className="section-label">Assets</div>
        {project.assets.map((asset) => (
          <ListItem key={asset.id}>
            <strong>{asset.name}</strong>
            <span>{asset.kind}</span>
          </ListItem>
        ))}
      </section>

      <section>
        <div className="section-label">Annotations</div>
        {project.annotations.map((annotation) => (
          <ListItem key={annotation.id}>
            <strong>{annotation.label}</strong>
            <span>{Math.round(annotation.startMs / 1000)}s</span>
          </ListItem>
        ))}
      </section>
    </Panel>
  );
}
