import { ProjectPlanner } from "../../components/project-planner";

export const metadata = {
  title: "Project Planner",
  description: "Plan a Black Lion Studios project, organize its scope, and prepare a request.",
  alternates: { canonical: "/plan" }
};

export default function PlanPage() {
  return (
    <div className="page-shell">
      <main className="stack">
        <ProjectPlanner />
      </main>
    </div>
  );
}
