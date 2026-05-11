import { CreateProjectForm } from '@/components/CreateProjectForm';

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">New Project</h1>
      <CreateProjectForm />
    </div>
  );
}
