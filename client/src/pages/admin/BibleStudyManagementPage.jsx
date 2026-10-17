import { BookOpen, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { publicService, unwrap } from "../../services/api.js";
import useAsync from "../../hooks/useAsync.js";
import DataState from "../../components/ui/DataState.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import Button from "../../components/ui/Button.jsx";

export default function BibleStudyManagementPage() {
  const groups = useAsync(
    async () => unwrap(await publicService.bibleStudyGroups()) ?? [],
    [],
  );

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Bible study groups</h1>
          <p>Manage existing study groups. New groups are registered through the Registration Center.</p>
        </div>
        <div className="page-actions">
          <Button asChild iconRight={<Plus size={15} />}>
            <Link to="/admin/registrations?type=bible-study-group">
            New group
            </Link>
          </Button>
        </div>
      </div>

      <DataState
        query={groups}
        feature="Bible study management"
        endpoint="/admin/bible-study-groups"
        emptyState={
          <EmptyState
            icon={<BookOpen size={30} />}
            title="No groups yet"
            description="Groups created here are visible to members on the Bible study pages."
            action={
              <Button asChild iconRight={<Plus size={15} />}>
                <Link to="/admin/registrations?type=bible-study-group">
                Create the first group
                </Link>
              </Button>
            }
          />
        }
      >
        {(list) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Leader</th>
                  <th>Meets</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {list.map((g) => (
                  <tr key={g.id ?? g.title}>
                    <td>
                      <strong>{g.name ?? g.title}</strong>
                    </td>
                    <td className="muted">{g.leaderName ?? g.leader ?? "—"}</td>
                    <td className="muted">{g.meetingSchedule ?? "—"}</td>
                    <td className="muted">{g.location ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>
    </div>
  );
}
