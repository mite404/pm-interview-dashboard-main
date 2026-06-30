import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export default function App() {
  const groups = useQuery(api.groups.getAll, {});

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 32,
        maxWidth: 720,
      }}
    >
      <h1>PlanMonster Dashboard</h1>
      <p>Hello world! This page pulls live data from the Convex deployment.</p>

      <h2>Registered Groups</h2>
      {groups === undefined ? (
        <p>Loading...</p>
      ) : groups.length === 0 ? (
        <p>No groups found.</p>
      ) : (
        <ul>
          {groups.map((g) => (
            <li key={g._id}>
              <strong>{g.name}</strong> — {g.jid}
              {g.capabilities && g.capabilities.length > 0 && (
                <span> ({g.capabilities.join(", ")})</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
