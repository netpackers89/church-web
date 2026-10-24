import { useState } from "react";
import { HeartHandshake, RefreshCw, UserRoundCheck } from "lucide-react";
import { adminService, unwrap } from "../../services/api.js";
import useAsync from "../../hooks/useAsync.js";
import Button from "../../components/ui/Button.jsx";
import Alert from "../../components/ui/Alert.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorMessage from "../../components/feedback/ErrorMessage.jsx";
import { CardSkeleton } from "../../components/ui/Skeleton.jsx";
import { useToast } from "../../components/feedback/ToastProvider.jsx";

const STATUS_OPTIONS = [
  "NEWCOMER",
  "NEW_BELIEVER",
  "FOLLOW_UP",
  "TEACHING",
  "BAPTISM_PREPARATION",
  "BAPTIZED",
  "ACTIVE_MEMBER",
  "RETURNING",
  "CONTINUING_MEMBER",
  "INACTIVE",
];

function displayStatus(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function NewChristianFollowupsPage() {
  const { success } = useToast();
  const [busy, setBusy] = useState({});
  const [actionError, setActionError] = useState("");
  const result = useAsync(async () => {
    const [itemsResponse, assigneesResponse] = await Promise.all([
      adminService.newChristianFollowups({ limit: 100 }),
      adminService.followupAssignees(),
    ]);
    return {
      records: unwrap(itemsResponse) ?? [],
      assignees: unwrap(assigneesResponse) ?? [],
    };
  }, []);

  async function updateRecord(record, payload, message) {
    setBusy((current) => ({ ...current, [record.id]: true }));
    setActionError("");
    try {
      await adminService.updateNewChristianFollowup(record.id, payload);
      await result.reload();
      success(message);
    } catch (error) {
      setActionError(
        error.message || "The follow-up record could not be updated.",
      );
    } finally {
      setBusy((current) => ({ ...current, [record.id]: false }));
    }
  }

  async function retry(record, channel) {
    setBusy((current) => ({ ...current, [`${record.id}-${channel}`]: true }));
    setActionError("");
    try {
      await adminService.retryNewChristianWelcome(record.id, channel);
      await result.reload();
      success(
        `${channel === "email" ? "Email" : "Telegram"} welcome delivered`,
      );
    } catch (error) {
      setActionError(
        error.message || `The ${channel} welcome could not be delivered.`,
      );
      await result.reload();
    } finally {
      setBusy((current) => ({
        ...current,
        [`${record.id}-${channel}`]: false,
      }));
    }
  }

  if (result.loading)
    return (
      <div className="event-grid">
        {Array.from({ length: 3 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    );
  if (result.error)
    return (
      <ErrorMessage
        error={result.error}
        onRetry={result.reload}
        title="We couldn't load follow-ups"
      />
    );

  const records = result.data?.records ?? [];
  const assignees = result.data?.assignees ?? [];

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="eyebrow blue">
            <HeartHandshake size={15} /> Pastoral care
          </span>
          <h1>New Christian Follow-up</h1>
          <p>
            Review consented requests, assign a follow-up teammate, and record
            each person’s next step.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<RefreshCw size={15} />}
          onClick={result.reload}
        >
          Refresh
        </Button>
      </div>

      {actionError ? <Alert variant="danger">{actionError}</Alert> : null}

      {!records.length ? (
        <EmptyState
          icon={<HeartHandshake size={28} />}
          title="No follow-up requests yet"
          description="New responses will appear here after someone submits the public New Christian form."
        />
      ) : (
        <div className="table-wrap">
          <table className="table followup-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Preferred contact</th>
                <th>Journey</th>
                <th>Assigned to</th>
                <th>Welcome messages</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>{record.fullName}</strong>
                    <div className="muted">{record.location}</div>
                    <details className="followup-details">
                      <summary>Request details</summary>
                      <div className="followup-private-details">
                        <span>
                          Answer:{" "}
                          {record.acceptedJesus ? "Accepted Jesus" : "Not yet"}
                        </span>
                        {!record.acceptedJesus ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={Boolean(busy[record.id])}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Confirm that the person has now accepted Jesus during pastoral follow-up? This will be recorded in the audit history.",
                                )
                              ) {
                                updateRecord(
                                  record,
                                  {
                                    acceptedJesus: true,
                                    status: "NEW_BELIEVER",
                                  },
                                  "Acceptance recorded and journey advanced",
                                );
                              }
                            }}
                          >
                            Record later acceptance
                          </Button>
                        ) : null}
                        {record.prayerRequest ? (
                          <p>{record.prayerRequest}</p>
                        ) : (
                          <span>No prayer message included.</span>
                        )}
                        <span>
                          Submitted{" "}
                          {new Date(record.createdAt).toLocaleString()}
                        </span>
                        {record.linkedUserId ? (
                          <span>
                            Linked to member account:{" "}
                            {record.linkedUserName || record.linkedUserId}. The
                            follow-up and account records remain separate.
                          </span>
                        ) : (
                          <VerifiedMemberLinker
                            record={record}
                            onLinked={result.reload}
                          />
                        )}
                      </div>
                    </details>
                  </td>
                  <td>
                    <span>{displayStatus(record.preferredContactMethod)}</span>
                    {record.phone ? (
                      <a
                        className="followup-contact"
                        href={`tel:${record.phone}`}
                      >
                        {record.phone}
                      </a>
                    ) : null}
                    {record.email ? (
                      <a
                        className="followup-contact"
                        href={`mailto:${record.email}`}
                      >
                        {record.email}
                      </a>
                    ) : null}
                    <small className="muted">
                      Language: {record.preferredLanguage}
                    </small>
                  </td>
                  <td>
                    <select
                      aria-label={`Journey status for ${record.fullName}`}
                      value={record.status}
                      disabled={Boolean(busy[record.id])}
                      onChange={(event) =>
                        updateRecord(
                          record,
                          { status: event.target.value },
                          "Follow-up status updated",
                        )
                      }
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {displayStatus(status)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`Assigned teammate for ${record.fullName}`}
                      value={record.assignedToUserId ?? ""}
                      disabled={Boolean(busy[record.id])}
                      onChange={(event) =>
                        updateRecord(
                          record,
                          {
                            assignedToUserId: event.target.value
                              ? Number(event.target.value)
                              : null,
                          },
                          "Follow-up assignment updated",
                        )
                      }
                    >
                      <option value="">Unassigned</option>
                      {assignees.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                    {record.assignedToName ? (
                      <small className="followup-assigned">
                        <UserRoundCheck size={13} /> {record.assignedToName}
                      </small>
                    ) : null}
                  </td>
                  <td>
                    <DeliveryStatus
                      label="Email"
                      status={record.emailDeliveryStatus}
                      error={record.emailDeliveryError}
                    />
                    {record.emailDeliveryStatus === "FAILED" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={Boolean(busy[`${record.id}-email`])}
                        onClick={() => retry(record, "email")}
                      >
                        Retry email
                      </Button>
                    ) : null}
                    <DeliveryStatus
                      label="Telegram"
                      status={
                        record.telegramConnected
                          ? record.telegramDeliveryStatus
                          : "NOT_CONNECTED"
                      }
                      error={record.telegramDeliveryError}
                    />
                    {record.telegramConnected &&
                    record.telegramDeliveryStatus === "FAILED" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={Boolean(busy[`${record.id}-telegram`])}
                        onClick={() => retry(record, "telegram")}
                      >
                        Retry Telegram
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DeliveryStatus({ label, status, error }) {
  const text =
    status === "DELIVERED"
      ? "Delivered"
      : status === "FAILED"
        ? "Failed"
        : status === "PENDING"
          ? "Pending"
          : status === "NOT_CONNECTED"
            ? "Not connected"
            : "Not sent";
  return (
    <div className="followup-delivery" title={error || undefined}>
      <span>{label}</span>
      <span
        className={`badge ${status === "DELIVERED" ? "badge-success" : status === "FAILED" ? "badge-danger" : "badge-neutral"}`}
      >
        {text}
      </span>
    </div>
  );
}

function VerifiedMemberLinker({ record, onLinked }) {
  const { success } = useToast();
  const [identifier, setIdentifier] = useState("");
  const [identifierType, setIdentifierType] = useState("email");
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function search(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCandidates([]);
    try {
      const response = await adminService.followupLinkCandidates(record.id, {
        [identifierType]: identifier.trim(),
      });
      setCandidates(unwrap(response) ?? []);
      if (!response.data?.data?.length)
        setError("No active member account matched that verified identifier.");
    } catch (failure) {
      setError(
        failure.message || "Could not search for a verified account match.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function link(user) {
    setBusy(true);
    setError("");
    try {
      await adminService.linkFollowupToMember(record.id, user.id);
      success("Verified member account linked");
      setCandidates([]);
      onLinked();
    } catch (failure) {
      setError(failure.message || "The member account could not be linked.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="followup-linker">
      <strong>Link a later member account</strong>
      <span>
        Search by verified email or verified phone only. No automatic merge is
        performed.
      </span>
      <form className="followup-link-search" onSubmit={search}>
        <select
          aria-label="Verified identifier type"
          value={identifierType}
          onChange={(event) => setIdentifierType(event.target.value)}
        >
          <option value="email">Verified email</option>
          <option value="phone">Verified phone</option>
        </select>
        <input
          aria-label={
            identifierType === "email"
              ? "Verified email address"
              : "Verified phone number"
          }
          type={identifierType === "email" ? "email" : "tel"}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
          placeholder={
            identifierType === "email" ? "name@example.com" : "+251..."
          }
        />
        <Button type="submit" size="sm" variant="secondary" loading={busy}>
          Search
        </Button>
      </form>
      {error ? (
        <small className="followup-link-error" role="alert">
          {error}
        </small>
      ) : null}
      {candidates.map((user) => (
        <div className="followup-candidate" key={user.id}>
          <span>
            {user.name}{" "}
            <small className="muted">{user.email || user.phone}</small>
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => link(user)}
          >
            Link record
          </Button>
        </div>
      ))}
    </div>
  );
}
