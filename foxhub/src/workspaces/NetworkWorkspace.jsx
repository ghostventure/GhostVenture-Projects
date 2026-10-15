import { useState } from "react";

import { TRUST_TIER_ORDER, getContactTrustTier, getTrustRestrictionLine, getTrustTierMeta } from "../rules.js";

import { trustTierBadgeClass, verificationBadgeModel, FilteredEmptyState } from "./shared.jsx";

export function NetworkWorkspace({ state, activeCircle, selectCircle, busy, startDirectThread, openPublicProfile, selectThread, setActiveTab, rateContactTrust, createGroupConversation, respondFriendRequest, addEndorsement, addJobPost, moderateRatingRecord }) {
  const [endorsementDraft, setEndorsementDraft] = useState({ toContactId: "", skill: "", note: "" });
  const [jobDraft, setJobDraft] = useState({ title: "", team: "", location: "", type: "Contract" });
  const [groupDraft, setGroupDraft] = useState({ name: "", type: "private", topic: "", memberIds: [] });
  const suggestedContacts = [...state.contacts]
    .sort((a, b) => (b.relationshipScore || 0) - (a.relationshipScore || 0))
    .slice(0, 4);
  const profileSnapshots = (state.reputationSnapshots || [])
    .filter((item) => item.targetType === "contact")
    .slice(0, 4);
  const profileRatingQueue = (state.ratingModerationQueue || [])
    .filter((item) => item.targetType === "contact" && item.status === "open")
    .slice(0, 4);
  const memberRecords = (state.userRecords || []).slice(0, 4);
  const groupThreads = (state.threads || []).filter((thread) => thread.type === "community" || thread.type === "private-group");
  const pendingFriendRequests = (state.friendRequests || []).slice(0, 6);
  const highTrustContacts = state.contacts
    .filter((contact) => ["AAA", "AA", "A"].includes(getContactTrustTier(contact)))
    .slice(0, 6);
  const trustedCircleCount = state.circles.filter((circle) => String(circle.trust || "").toLowerCase().includes("trusted")).length;
  const privateGroupCount = groupThreads.filter((thread) => thread.type === "private-group").length;
  const rapportReviewCount = profileRatingQueue.length + pendingFriendRequests.length;
  const rapportLanes = [
    {
      id: "personal",
      label: "Personal",
      count: state.contacts.filter((contact) => ["creator", "personal"].includes(contact.accountType)).length,
      detail: "Friends, creators, family-style ties, and direct social presence."
    },
    {
      id: "professional",
      label: "Professional",
      count: (state.professionalIdentities || []).length + (state.endorsements || []).length,
      detail: "Work identity, endorsements, resumes, hiring, and expertise."
    },
    {
      id: "communal",
      label: "Communal",
      count: state.circles.length + groupThreads.length,
      detail: "Circles, private groups, community channels, moments, and shared belonging."
    },
    {
      id: "service",
      label: "Service",
      count: (state.listings || []).filter((listing) => ["Services", "Gigs", "Community"].includes(listing.category)).length,
      detail: "Needs, referrals, creators, merchants, bookings, and local work."
    }
  ];
  const strongestIntroductions = suggestedContacts.map((contact) => ({
    ...contact,
    sharedContext: `${contact.city || "Local"} · ${contact.referralSource || contact.preferredSurface || "known through FoxHub"}`
  }));
  const communityServiceSignals = (state.listings || [])
    .filter((listing) => ["Services", "Gigs", "Community", "Jobs"].includes(listing.category))
    .slice(0, 4);
  const rapportSummaryCards = [
    {
      label: "Trusted people",
      value: highTrustContacts.length,
      detail: "Contacts with A-tier or better relationship trust."
    },
    {
      label: "Introductions",
      value: strongestIntroductions.length,
      detail: "Best people to reach from your current graph."
    },
    {
      label: "Private groups",
      value: privateGroupCount,
      detail: "Smaller rooms built around known relationships."
    },
    {
      label: "Review items",
      value: rapportReviewCount,
      detail: "Friend requests and trust ratings that need a decision."
    }
  ];

  function toggleGroupMember(memberId) {
    setGroupDraft((current) => {
      const exists = current.memberIds.includes(memberId);
      return {
        ...current,
        memberIds: exists ? current.memberIds.filter((item) => item !== memberId) : [...current.memberIds, memberId]
      };
    });
  }

  async function submitEndorsement(event) {
    event.preventDefault();
    if (!endorsementDraft.toContactId || !endorsementDraft.skill.trim()) return;
    await addEndorsement({
      fromContactId: state.profile.handle || "self",
      ...endorsementDraft
    });
    setEndorsementDraft({ toContactId: "", skill: "", note: "" });
  }

  async function submitJobPost(event) {
    event.preventDefault();
    if (!jobDraft.title.trim()) return;
    await addJobPost(jobDraft);
    setJobDraft({ title: "", team: "", location: "", type: "Contract" });
  }

  async function submitGroup(event) {
    event.preventDefault();
    if (!groupDraft.name.trim()) return;
    await createGroupConversation(groupDraft);
    setGroupDraft({ name: "", type: "private", topic: "", memberIds: [] });
    setActiveTab("chat");
  }

  return (
    <>
      <section className="rapport-hero network-rapport-hero" aria-label="Rapport graph">
        <div className="rapport-hero-copy">
          <p className="eyebrow">Rapport</p>
          <h2>Know who someone is, how you know them, and what is safe to do together.</h2>
          <p>
            Rapport keeps the people layer focused: trust grades, shared circles, introductions, requests, and reputation signals are grouped here instead of mixed with the feed or market.
          </p>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={() => createGroupConversation?.({ name: "Rapport Circle", type: "private", topic: "Trusted introductions", memberIds: state.contacts.slice(0, 3).map((contact) => contact.id) })} disabled={busy}>
              Form rapport circle
            </button>
            <button type="button" className="ghost-button small" onClick={() => setActiveTab("market")}>
              Open market signals
            </button>
          </div>
        </div>
        <div className="rapport-lane-grid">
          {rapportLanes.map((lane) => (
            <article key={lane.id} className="rapport-lane-card">
              <span>{lane.label}</span>
              <strong>{lane.count}</strong>
              <p>{lane.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rapport-command-center" aria-label="Rapport command center">
        <div className="rapport-summary-grid">
          {rapportSummaryCards.map((card) => (
            <article key={card.label} className="rapport-summary-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>
        <article className="surface rapport-action-panel">
          <div className="surface-head">
            <p className="card-label">Trusted introductions</p>
            <span className="badge subtle">{trustedCircleCount} trusted circles</span>
          </div>
          <div className="list-stack">
            {highTrustContacts.slice(0, 3).map((contact) => (
              <div key={contact.id} className="list-row">
                <div>
                  <strong>{contact.displayName || contact.name}</strong>
                  <p>{contact.handle} · {contact.city || "FoxHub"}</p>
                </div>
                <div className="inline-actions wrap">
                  <span className={trustTierBadgeClass(getContactTrustTier(contact))}>{getContactTrustTier(contact)}</span>
                  <button type="button" className="ghost-button small" onClick={() => openPublicProfile?.(contact.id)}>
                    View profile
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => void startDirectThread(contact.id)}>
                    Message
                  </button>
                </div>
              </div>
            ))}
            {!highTrustContacts.length ? <p className="panel-copy">Rate contacts to build trusted introduction paths.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel rapport-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Introduction map</p>
            <span className="badge subtle">{strongestIntroductions.length} candidates</span>
          </div>
          <div className="list-stack">
            {strongestIntroductions.map((contact) => (
              <div key={contact.id} className="list-row">
                <div>
                  <strong>{contact.displayName || contact.name}</strong>
                  <p>{contact.sharedContext}</p>
                </div>
                <div className="inline-actions wrap">
                  <span className="badge subtle">{contact.relationshipScore || 0} rapport</span>
                  <button type="button" className="ghost-button small" onClick={() => openPublicProfile?.(contact.id)}>
                    View profile
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => void startDirectThread(contact.id)}>
                    Message
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Service trust signals</p>
            <span className="badge subtle">{communityServiceSignals.length} signals</span>
          </div>
          <div className="list-stack">
            {communityServiceSignals.map((listing) => (
              <div key={listing.id} className="list-row">
                <div>
                  <strong>{listing.title}</strong>
                  <p>{listing.category} · {listing.city} · {listing.description}</p>
                </div>
                <div className="row-meta-text">{listing.verified ? "trusted source" : "community ask"}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-row three-up service-panel compliance-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Contacts</p>
            <span className="badge subtle">{state.contacts.length} people</span>
          </div>
          <div className="surface-note">
            Trusted people, direct entry points, and profile signals.
          </div>
          <div className="list-stack">
            {state.contacts.map((contact) => {
              const trustTier = getContactTrustTier(contact);
              const trustMeta = getTrustTierMeta(trustTier);
              const verificationBadge = verificationBadgeModel(contact.verificationLevel);
              return (
                <div key={contact.id} className="contact-card">
                  <button type="button" className="list-button contact-button" onClick={() => openPublicProfile?.(contact.id)}>
                    <div className="thread-topline">
                      <strong>{contact.displayName || contact.name}</strong>
                      <span className={`presence-chip ${contact.presenceState || "away"}`}>{contact.presenceState || "away"}</span>
                    </div>
                    <p>{contact.handle} · {contact.city}</p>
                    <div className="contact-trust-row">
                      <span className={trustTierBadgeClass(trustTier)}>{trustTier} · {trustMeta.label}</span>
                      <span className={verificationBadge.className} title={contact.verificationLevel || "Verification status"}>
                        {verificationBadge.label}
                      </span>
                    </div>
                    <span>
                      {typeof contact.peerRatingAverage === "number" ? `${contact.peerRatingAverage.toFixed(1)} / 5` : "No peer rating"} · {contact.peerRatingCount || 0} ratings
                    </span>
                    <span>{getTrustRestrictionLine(trustTier)}</span>
                  </button>
                  <div className="inline-actions wrap">
                    <button type="button" className="ghost-button small" onClick={() => openPublicProfile?.(contact.id)}>
                      View profile
                    </button>
                    <button type="button" className="ghost-button small" onClick={() => void startDirectThread(contact.id)}>
                      Message
                    </button>
                  </div>
                  <div className="trust-rating-strip">
                    {TRUST_TIER_ORDER.map((grade) => (
                      <button
                        key={grade}
                        type="button"
                        className={contact.myPeerRating === grade ? "trust-grade-chip active" : "trust-grade-chip"}
                        onClick={() => rateContactTrust(contact.id, grade)}
                        disabled={busy}
                      >
                        {grade}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Circles</p>
            <span className="badge subtle">{activeCircle?.trust || "active"}</span>
          </div>
          <div className="surface-note">
            Smaller communities and local network context.
          </div>
          <div className="list-stack">
            {state.circles.map((circle) => (
              <button
                key={circle.id}
                type="button"
                className={circle.id === state.activeCircleId ? "list-button active" : "list-button"}
                onClick={() => selectCircle(circle.id)}
              >
                <strong>{circle.name}</strong>
                <p>{circle.focus}</p>
                <span>{circle.members}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Groups</p>
            <span className="badge subtle">{groupThreads.length} active</span>
          </div>
          <div className="surface-note">
            Private groups for trusted circles, and community groups for larger open conversation.
          </div>
          <form className="market-form" onSubmit={submitGroup}>
            <label>
              Group name
              <input
                value={groupDraft.name}
                onChange={(event) => setGroupDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Weekend Creators"
              />
            </label>
            <label>
              Group type
              <select
                value={groupDraft.type}
                onChange={(event) => setGroupDraft((current) => ({ ...current, type: event.target.value }))}
              >
                <option value="private">Private group</option>
                <option value="community">Community group</option>
              </select>
            </label>
            <label>
              Topic
              <input
                value={groupDraft.topic}
                onChange={(event) => setGroupDraft((current) => ({ ...current, topic: event.target.value }))}
                placeholder="Collabs, gigs, local updates"
              />
            </label>
            <label>
              Add members
              <div className="inline-actions wrap">
                {state.contacts.slice(0, 8).map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    className={groupDraft.memberIds.includes(contact.id) ? "ghost-button small active-soft" : "ghost-button small"}
                    onClick={() => toggleGroupMember(contact.id)}
                  >
                    {contact.displayName || contact.name}
                  </button>
                ))}
              </div>
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Create group</button>
          </form>
          <div className="list-stack">
            {groupThreads.slice(0, 8).map((thread) => (
              <div key={thread.id} className="list-row">
                <button
                  type="button"
                  className="list-button inline-list-button"
                  onClick={() => {
                    selectThread(thread.id);
                    setActiveTab("chat");
                  }}
                >
                  <div>
                    <strong>{thread.name}</strong>
                    <p>{thread.type === "private-group" ? "Private group" : "Community group"}</p>
                  </div>
                  <div className="row-meta-text">{thread.members} members</div>
                </button>
              </div>
            ))}
            {!groupThreads.length ? (
              <div className="list-row">
                <div>
                  <strong>No groups yet</strong>
                  <p>Create a private or community group to start group chat.</p>
                </div>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel merchant-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Friend requests</p>
            <span className="badge subtle">{pendingFriendRequests.length} pending</span>
          </div>
          <div className="surface-note">
            Accept or ignore new connection requests. Accepted people move into your contacts automatically.
          </div>
          <div className="list-stack">
            {pendingFriendRequests.map((request) => (
              <div key={request.id} className="list-row">
                <div>
                  <strong>{request.name}</strong>
                  <p>{request.handle} · {request.city}</p>
                  <span>{request.mutualCount} mutual connections</span>
                </div>
                <div className="inline-actions wrap">
                  <button type="button" className="ghost-button small" onClick={() => respondFriendRequest(request.id, "accept")} disabled={busy}>
                    Accept
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => respondFriendRequest(request.id, "ignore")} disabled={busy}>
                    Ignore
                  </button>
                </div>
              </div>
            ))}
            {!pendingFriendRequests.length ? <p className="panel-copy">No pending friend requests right now.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Trust records</p>
            <span className="badge subtle">{(state.userRecords || []).length} tracked</span>
          </div>
          <div className="surface-note">
            Member identity state, support tier, and wallet status stay visible as context for rapport decisions.
          </div>
          <div className="list-stack">
            {memberRecords.map((record) => (
              <div key={record.id} className="list-row">
                <div>
                  <strong>{record.profile?.displayName || record.contactId || record.id}</strong>
                  <p>{record.accountType} · {record.stage} · {record.supportTier}</p>
                </div>
                <div className="row-meta-text">{record.identityState} · {record.walletState}</div>
              </div>
            ))}
            {!memberRecords.length ? <p className="panel-copy">No member records are available yet.</p> : null}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Profile reputation</p>
            <span className="badge subtle">{profileSnapshots.length} tracked</span>
          </div>
          <div className="list-stack">
            {profileSnapshots.map((snapshot) => (
              <div key={snapshot.id} className="list-row">
                <div>
                  <strong>{snapshot.label}</strong>
                  <p>{snapshot.averageRating?.toFixed ? snapshot.averageRating.toFixed(1) : snapshot.averageRating} / 5 · {snapshot.ratingCount} ratings</p>
                </div>
                <div className="row-meta-text">{snapshot.trustTier} · {snapshot.verification}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Rating review queue</p>
            <span className="badge subtle">{profileRatingQueue.length} open</span>
          </div>
          <div className="list-stack">
            {profileRatingQueue.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.targetId}</strong>
                  <p>{item.reason}</p>
                </div>
                <div className="inline-actions wrap">
                  <button type="button" className="ghost-button small" onClick={() => moderateRatingRecord(item.recordId, "approved")}>
                    Approve
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => moderateRatingRecord(item.recordId, "removed")}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {!profileRatingQueue.length ? <p className="panel-copy">No profile ratings need review.</p> : null}
          </div>
        </article>
      </section>

      <section className="surface-row two-up service-panel overview-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Profiles and resumes</p>
            <span className="badge subtle">{(state.professionalIdentities || []).length} profiles · {(state.resumeEntries || []).length} resume items</span>
          </div>
          <div className="list-stack">
            {(state.professionalIdentities || []).slice(0, 4).map((profile) => (
              <div key={profile.id} className="list-row">
                <div>
                  <strong>{profile.name}</strong>
                  <p>{profile.role} · {profile.company || profile.city || "FoxHub"}</p>
                </div>
                <div className="row-meta-text">{profile.verification || profile.trust || "active"}</div>
              </div>
            ))}
            {(state.resumeEntries || []).slice(0, 3).map((entry) => (
              <div key={entry.id} className="list-row">
                <div>
                  <strong>{entry.title}</strong>
                  <p>{entry.organization || entry.company || entry.location || "Profile record"}</p>
                </div>
                <div className="row-meta-text">{entry.period || entry.status || "saved"}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Professional graph tools</p>
            <span className="badge subtle">{(state.endorsements || []).length} endorsements · {(state.jobPosts || []).length} jobs</span>
          </div>
          <form className="market-form" onSubmit={submitEndorsement}>
            <label>
              Person
              <select value={endorsementDraft.toContactId} onChange={(event) => setEndorsementDraft((current) => ({ ...current, toContactId: event.target.value }))}>
                <option value="">Select contact</option>
                {state.contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.displayName || contact.name}</option>
                ))}
              </select>
            </label>
            <label>
              Skill
              <input value={endorsementDraft.skill} onChange={(event) => setEndorsementDraft((current) => ({ ...current, skill: event.target.value }))} />
            </label>
            <label>
              Note
              <input value={endorsementDraft.note} onChange={(event) => setEndorsementDraft((current) => ({ ...current, note: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Add endorsement</button>
          </form>
          <form className="market-form" onSubmit={submitJobPost}>
            <label>
              Job title
              <input value={jobDraft.title} onChange={(event) => setJobDraft((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              Team
              <input value={jobDraft.team} onChange={(event) => setJobDraft((current) => ({ ...current, team: event.target.value }))} />
            </label>
            <label>
              Location
              <input value={jobDraft.location} onChange={(event) => setJobDraft((current) => ({ ...current, location: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Post job</button>
          </form>
          <div className="list-stack">
            {(state.endorsements || []).slice(0, 3).map((endorsement) => (
              <div key={endorsement.id} className="list-row">
                <div>
                  <strong>{endorsement.skill}</strong>
                  <p>{endorsement.note || "Professional endorsement"}</p>
                </div>
                <div className="row-meta-text">{endorsement.toContactId || endorsement.author || "saved"}</div>
              </div>
            ))}
            {(state.jobPosts || []).slice(0, 3).map((job) => (
              <div key={job.id} className="list-row">
                <div>
                  <strong>{job.title}</strong>
                  <p>{job.team || "FoxHub"} · {job.location || "Flexible"}</p>
                </div>
                <div className="row-meta-text">{job.type || "Open"}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
      {!state.contacts.length && !state.circles.length && !state.channels.length ? (
        <FilteredEmptyState label="Network" />
      ) : null}
    </>
  );
}
