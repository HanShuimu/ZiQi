import { WorkbenchShell } from "./components/WorkbenchShell";
import { createMockProjectSummary } from "./domain/project/mockProject";

const project = createMockProjectSummary();

export function App() {
  return <WorkbenchShell project={project} />;
}

