function cx(...tokens) {
  return tokens.filter(Boolean).join(" ");
}

function getItemTitle(item) {
  return item.title || item.name || item.label || "Untitled component";
}

function getItemDescription(item) {
  return item.description || item.copy || item.note || "";
}

function getItemKey(item, index, prefix = "item") {
  return item.id || item.slug || item.key || `${prefix}-${getItemTitle(item)}-${index}`;
}

function normalizeGroups(groups) {
  if (!Array.isArray(groups)) {
    return [];
  }

  return groups.map((group, index) => ({
    ...group,
    title: group.title || group.name || group.label || `Group ${index + 1}`,
    items: Array.isArray(group.items) ? group.items : []
  }));
}

function countItems(groups) {
  return groups.reduce((total, group) => total + group.items.length, 0);
}

export function ModelApplicationComponentLibrary({
  eyebrow = "Model application library",
  title = "Component inventory",
  copy,
  groups = [],
  stats = [],
  emptyTitle = "No components available",
  emptyCopy = "Pass grouped inventory items to render this library.",
  className = ""
}) {
  const normalizedGroups = normalizeGroups(groups);
  const itemCount = countItems(normalizedGroups);
  const computedStats = stats.length
    ? stats
    : [
        { label: "Groups", value: normalizedGroups.length },
        { label: "Components", value: itemCount }
      ];

  return (
    <section className={cx("model-application-component-library", "ui-section-stack", className)}>
      <ModelApplicationComponentLibraryHeader
        eyebrow={eyebrow}
        title={title}
        copy={copy}
      />
      <ModelApplicationComponentStats items={computedStats} />
      {normalizedGroups.length ? (
        <div className="model-component-group-stack ui-surface-grid">
          {normalizedGroups.map((group, index) => (
            <ModelApplicationComponentGroup
              group={group}
              key={getItemKey(group, index, "group")}
            />
          ))}
        </div>
      ) : (
        <ModelApplicationComponentEmptyState title={emptyTitle} copy={emptyCopy} />
      )}
    </section>
  );
}

export function ModelApplicationComponentLibraryHeader({
  eyebrow,
  title,
  copy,
  className = ""
}) {
  return (
    <header className={cx("model-component-library-header", "ui-panel-header", className)}>
      <div>
        {eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {copy ? <p className="ui-panel-copy">{copy}</p> : null}
      </div>
    </header>
  );
}

export function ModelApplicationComponentStats({ items = [], className = "" }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className={cx("model-component-stats", "ui-summary-stat-row", className)}>
      {items.map((item, index) => (
        <div className="ui-summary-stat" key={getItemKey(item, index, "stat")}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function ModelApplicationComponentGroup({ group, className = "" }) {
  const items = Array.isArray(group.items) ? group.items : [];

  return (
    <section className={cx("model-component-group", "ui-form-section-card", className)}>
      <div className="ui-form-section-head">
        <strong>{group.title || group.name || group.label}</strong>
        {group.copy || group.description ? <p>{group.copy || group.description}</p> : null}
      </div>
      {group.summaryItems?.length ? (
        <ModelApplicationComponentMetaList items={group.summaryItems} />
      ) : null}
      {items.length ? (
        <div className="model-component-card-grid ui-value-card-grid">
          {items.map((item, index) => (
            <ModelApplicationComponentCard
              item={item}
              key={getItemKey(item, index, group.id || group.title || "component")}
            />
          ))}
        </div>
      ) : (
        <ModelApplicationComponentEmptyState
          title="No components in this group"
          copy="Add items to this group to render component cards."
          compact
        />
      )}
    </section>
  );
}

export function ModelApplicationComponentCard({ item, className = "" }) {
  const title = getItemTitle(item);
  const description = getItemDescription(item);
  const status = item.status || item.state || item.tone;
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const meta = Array.isArray(item.meta) ? item.meta : [];
  const fields = Array.isArray(item.fields) ? item.fields : [];
  const content = (
    <>
      <div className="model-component-card-head">
        {item.eyebrow || item.category ? <span>{item.eyebrow || item.category}</span> : null}
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {status ? <ModelApplicationComponentStatus label={status} tone={item.tone} /> : null}
      {fields.length ? <ModelApplicationComponentFieldList items={fields} /> : null}
      {meta.length ? <ModelApplicationComponentMetaList items={meta} /> : null}
      {tags.length ? <ModelApplicationComponentTagList items={tags} /> : null}
    </>
  );

  if (item.href) {
    return (
      <a className={cx("model-component-card", "ui-value-card", className)} href={item.href}>
        {content}
      </a>
    );
  }

  return (
    <article className={cx("model-component-card", "ui-value-card", className)}>
      {content}
    </article>
  );
}

export function ModelApplicationComponentStatus({
  label,
  tone = "neutral",
  className = ""
}) {
  return <span className={cx("ui-status-chip", tone, className)}>{label}</span>;
}

export function ModelApplicationComponentFieldList({ items = [], className = "" }) {
  if (!items.length) {
    return null;
  }

  return (
    <dl className={cx("model-component-field-list", "ui-detail-pair-grid", className)}>
      {items.map((item, index) => (
        <div className="ui-detail-pair" key={getItemKey(item, index, "field")}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ModelApplicationComponentMetaList({ items = [], className = "" }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className={cx("model-component-meta-list", className)}>
      {items.map((item, index) => (
        <div className="model-component-meta-item" key={getItemKey(item, index, "meta")}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function ModelApplicationComponentTagList({ items = [], className = "" }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className={cx("model-component-tag-list", "ui-status-chip-row", className)}>
      {items.map((item) => (
        <span className="ui-status-chip" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function ModelApplicationComponentEmptyState({
  title,
  copy,
  compact = false,
  className = ""
}) {
  return (
    <div className={cx("model-component-empty", compact ? "ui-empty-inline" : "ui-empty-block", className)}>
      <strong>{title}</strong>
      {copy ? <p>{copy}</p> : null}
    </div>
  );
}

export default ModelApplicationComponentLibrary;
