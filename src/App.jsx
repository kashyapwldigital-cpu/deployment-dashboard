import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const REFRESH_INTERVAL_MS = 30_000;
const FETCH_TIMEOUT_MS = 8_000;
const PROXY_URL_TEMPLATE = import.meta.env.VITE_DEPLOYMENT_PROXY_URL?.trim() || "";
const BATCH_PROXY_URL = import.meta.env.VITE_DEPLOYMENT_BATCH_PROXY_URL?.trim() || "";

// Add or update domains here.
const DEPLOYMENT_SOURCES = [
  {
    name: "dev.tixstock.com",
    deploymentInfoUrl: "https://dev.tixstock.com/deployment-info.json",
    websiteUrl: "https://dev.tixstock.com",
  },
  {
    name: "sandbox-new.tixstock.com",
    deploymentInfoUrl: "https://sandbox-new.tixstock.com/deployment-info.json",
    websiteUrl: "https://sandbox-new.tixstock.com",
  },
  {
    name: "sandbox-tickets.likewizemoments.com",
    deploymentInfoUrl: "https://sandbox-tickets.likewizemoments.com/deployment-info.json",
    websiteUrl: "https://sandbox-tickets.likewizemoments.com",
  },
  {
    name: "sandbox-txtrade.tixstock.com",
    deploymentInfoUrl: "https://sandbox-txtrade.tixstock.com/deployment-info.json",
    websiteUrl: "https://sandbox-txtrade.tixstock.com",
  },
  {
    name: "sandbox.tixstock.com",
    deploymentInfoUrl: "https://sandbox.tixstock.com/deployment-info.json",
    websiteUrl: "https://sandbox.tixstock.com",
  },
  {
    name: "sd.tixstock.com",
    deploymentInfoUrl: "https://sd.tixstock.com/deployment-info.json",
    websiteUrl: "https://sd.tixstock.com",
  },
  {
    name: "sd.tx-trade.com",
    deploymentInfoUrl: "https://sd.tx-trade.com/deployment-info.json",
    websiteUrl: "https://sd.tx-trade.com",
  },
  {
    name: "staging.tixstock.com",
    deploymentInfoUrl: "https://staging.tixstock.com/deployment-info.json",
    websiteUrl: "https://staging.tixstock.com",
  },
  {
    name: "staging.tx-trade.com",
    deploymentInfoUrl: "https://staging.tx-trade.com/deployment-info.json",
    websiteUrl: "https://staging.tx-trade.com",
  },
  {
    name: "test-my.tixstock.com",
    deploymentInfoUrl: "https://test-my.tixstock.com/deployment-info.json",
    websiteUrl: "https://test-my.tixstock.com",
  },
  {
    name: "test-my2.tixstock.com",
    deploymentInfoUrl: "https://test-my2.tixstock.com/deployment-info.json",
    websiteUrl: "https://test-my2.tixstock.com",
  },
  {
    name: "test-my3.tixstock.com",
    deploymentInfoUrl: "https://test-my3.tixstock.com/deployment-info.json",
    websiteUrl: "https://test-my3.tixstock.com",
  },
  {
    name: "test-my4.tixstock.com",
    deploymentInfoUrl: "https://test-my4.tixstock.com/deployment-info.json",
    websiteUrl: "https://test-my4.tixstock.com",
  },
  {
    name: "test-my5.tixstock.com",
    deploymentInfoUrl: "https://test-my5.tixstock.com/deployment-info.json",
    websiteUrl: "https://test-my5.tixstock.com",
  },
  {
    name: "test-release.tixstock.com",
    deploymentInfoUrl: "https://test-release.tixstock.com/deployment-info.json",
    websiteUrl: "https://test-release.tixstock.com",
  },
  {
    name: "tix-14199.tixstock.com",
    deploymentInfoUrl: "https://tix-14199.tixstock.com/deployment-info.json",
    websiteUrl: "https://tix-14199.tixstock.com",
  },
  {
    name: "uat-txtrade.tixstock.com",
    deploymentInfoUrl: "https://uat-txtrade.tixstock.com/deployment-info.json",
    websiteUrl: "https://uat-txtrade.tixstock.com",
  },
  {
    name: "uat.tixstock.com",
    deploymentInfoUrl: "https://uat.tixstock.com/deployment-info.json",
    websiteUrl: "https://uat.tixstock.com",
  },
  {
    name: "preprod.tixstock.com",
    deploymentInfoUrl: "https://preprod.tixstock.com/deployment-info.json",
    websiteUrl: "https://preprod.tixstock.com",
  },
  {
    name: "preprod.tx-trade.com",
    deploymentInfoUrl: "https://preprod.tx-trade.com/deployment-info.json",
    websiteUrl: "https://preprod.tx-trade.com",
  },
];

const emptyRowData = {
  branch: "N/A",
  buildTime: "N/A",
  apiUrl: "N/A",
  pfApiUrl: "N/A",
  firstName: "N/A",
  lastName: "N/A",
  gitUser: "N/A",
  gitEmail: "N/A",
  gitUserPhotoUrl: "",
};

const formatTimestamp = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fetchWithTimeout = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const getDashboardFetchUrl = (deploymentInfoUrl) => {
  if (import.meta.env.DEV) {
    return `/api/deployment-info?target=${encodeURIComponent(deploymentInfoUrl)}`;
  }
  if (PROXY_URL_TEMPLATE) {
    if (PROXY_URL_TEMPLATE.includes("{target}")) {
      return PROXY_URL_TEMPLATE.replace("{target}", encodeURIComponent(deploymentInfoUrl));
    }

    const proxyUrl = new URL(PROXY_URL_TEMPLATE);
    proxyUrl.searchParams.set("target", deploymentInfoUrl);
    return proxyUrl.toString();
  }
  return deploymentInfoUrl;
};

const buildOnlineSnapshot = (source, payload) => ({
  name: source.name,
  websiteUrl: source.websiteUrl,
  deploymentInfoUrl: source.deploymentInfoUrl,
  status: "online",
  branch: payload.branch || emptyRowData.branch,
  buildTime: payload.buildTime || emptyRowData.buildTime,
  apiUrl: payload.apiUrl || emptyRowData.apiUrl,
  pfApiUrl: payload.pfApiUrl || emptyRowData.pfApiUrl,
  firstName: payload.firstName || emptyRowData.firstName,
  lastName: payload.lastName || emptyRowData.lastName,
  gitUser: payload.gitUser || emptyRowData.gitUser,
  gitEmail: payload.gitEmail || emptyRowData.gitEmail,
  gitUserPhotoUrl: payload.gitUserPhotoUrl || emptyRowData.gitUserPhotoUrl,
});

const buildOfflineSnapshot = (source) => ({
  name: source.name,
  websiteUrl: source.websiteUrl,
  deploymentInfoUrl: source.deploymentInfoUrl,
  status: "offline",
  ...emptyRowData,
});

const fetchPerSource = async () =>
  Promise.all(
    DEPLOYMENT_SOURCES.map(async (source) => {
      try {
        const payload = await fetchWithTimeout(
          getDashboardFetchUrl(source.deploymentInfoUrl),
          FETCH_TIMEOUT_MS,
        );

        return buildOnlineSnapshot(source, payload);
      } catch {
        return buildOfflineSnapshot(source);
      }
    }),
  );

const fetchViaBatchProxy = async () => {
  const response = await fetch(BATCH_PROXY_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify({
      sources: DEPLOYMENT_SOURCES.map((source) => ({
        name: source.name,
        deploymentInfoUrl: source.deploymentInfoUrl,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Batch proxy HTTP ${response.status}`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const resultByUrl = new Map(
    results
      .filter((result) => result?.deploymentInfoUrl)
      .map((result) => [result.deploymentInfoUrl, result]),
  );

  return DEPLOYMENT_SOURCES.map((source) => {
    const result = resultByUrl.get(source.deploymentInfoUrl);
    if (!result) return buildOfflineSnapshot(source);
    if (result.status === "offline") return buildOfflineSnapshot(source);

    const resultPayload =
      result.payload && typeof result.payload === "object" ? result.payload : result;
    return buildOnlineSnapshot(source, resultPayload);
  });
};

function App() {
  const toolbarRef = useRef(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [lastRefreshAt, setLastRefreshAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "default",
    direction: "asc",
  });
  const [activeTooltipRow, setActiveTooltipRow] = useState("");
  const [copiedRow, setCopiedRow] = useState("");

  function getBuilderName(row) {
    const first = row.firstName && row.firstName !== "Unknown" ? row.firstName : "";
    const last = row.lastName && row.lastName !== "Unknown" ? row.lastName : "";
    const fullName = `${first} ${last}`.trim();
    if (fullName) return fullName;
    if (row.gitUser && row.gitUser !== "Unknown" && row.gitUser !== "N/A") return row.gitUser;
    return "N/A";
  }

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      let snapshots = [];
      if (BATCH_PROXY_URL) {
        try {
          snapshots = await fetchViaBatchProxy();
        } catch {
          snapshots = await fetchPerSource();
        }
      } else {
        snapshots = await fetchPerSource();
      }

      setRows(snapshots);
      setLastRefreshAt(new Date());
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    const intervalId = setInterval(loadDashboardData, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [loadDashboardData]);

  useEffect(() => {
    const updateToolbarHeightVar = () => {
      if (!toolbarRef.current) return;
      const height = Math.ceil(toolbarRef.current.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--toolbar-sticky-height", `${height}px`);
    };

    updateToolbarHeightVar();
    window.addEventListener("resize", updateToolbarHeightVar);

    const resizeObserver = new ResizeObserver(updateToolbarHeightVar);
    if (toolbarRef.current) {
      resizeObserver.observe(toolbarRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateToolbarHeightVar);
      resizeObserver.disconnect();
    };
  }, []);

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return rows;

    return rows.filter((row) =>
      [
        row.name,
        row.branch,
        row.websiteUrl,
        row.deploymentInfoUrl,
        row.apiUrl,
        row.pfApiUrl,
        row.gitUser,
        row.gitEmail,
      ].some((v) => String(v).toLowerCase().includes(search)),
    );
  }, [query, rows]);

  const getStatusWeight = (row) => (row.status === "online" ? 0 : 1);

  const getBuildTimestamp = (row) => {
    const timestamp = new Date(row.buildTime).getTime();
    return Number.isNaN(timestamp) ? -1 : timestamp;
  };

  const sortRows = (left, right) => {
    // Default sort: online first, then newest build time.
    if (sortConfig.key === "default") {
      const statusDiff = getStatusWeight(left) - getStatusWeight(right);
      if (statusDiff !== 0) return statusDiff;
      return getBuildTimestamp(right) - getBuildTimestamp(left);
    }

    let leftValue = "";
    let rightValue = "";

    switch (sortConfig.key) {
      case "name":
      case "branch":
        leftValue = String(left[sortConfig.key] || "").toLowerCase();
        rightValue = String(right[sortConfig.key] || "").toLowerCase();
        break;
      case "endpoints":
        leftValue = `${left.apiUrl || ""} ${left.pfApiUrl || ""}`.toLowerCase();
        rightValue = `${right.apiUrl || ""} ${right.pfApiUrl || ""}`.toLowerCase();
        break;
      case "status":
        leftValue = getStatusWeight(left);
        rightValue = getStatusWeight(right);
        break;
      case "builder":
        leftValue = getBuilderName(left).toLowerCase();
        rightValue = getBuilderName(right).toLowerCase();
        break;
      case "buildTime":
        leftValue = getBuildTimestamp(left);
        rightValue = getBuildTimestamp(right);
        break;
      default:
        leftValue = "";
        rightValue = "";
    }

    if (leftValue < rightValue) return sortConfig.direction === "asc" ? -1 : 1;
    if (leftValue > rightValue) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  };

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort(sortRows);
  }, [filteredRows, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: key === "buildTime" ? "desc" : "asc",
      };
    });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  const copyBuilderDetails = async (row) => {
    const details = `Name: ${getBuilderName(row)}
Username: ${row.gitUser || "N/A"}
Email: ${row.gitEmail || "N/A"}`;

    try {
      await navigator.clipboard.writeText(details);
      setCopiedRow(row.name);
      setTimeout(() => setCopiedRow(""), 1500);
    } catch {
      setCopiedRow("");
    }
  };

  const showInitialLoader = loading && !initialLoadComplete;
  const showNoResults = initialLoadComplete && !filteredRows.length;

  return (
    <main className="dashboard" onClick={() => setActiveTooltipRow("")}>
      <header className="header">
        <h1>Sandbox Deployment Dashboard</h1>
        <button type="button" className="sync-btn" onClick={loadDashboardData} disabled={loading}>
          {loading ? "Syncing..." : "Sync Data"}
        </button>
      </header>

      <section className="toolbar" ref={toolbarRef}>
        <label className="search">
          <span>Search:</span>
          <input
            type="text"
            placeholder="Domain or branch"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className="refresh-meta">
          <span className="label">Last Refresh:</span>
          <span>{lastRefreshAt ? formatTimestamp(lastRefreshAt) : "Loading..."}</span>
          {loading ? <small className="loading">Refreshing...</small> : null}
        </div>
      </section>

      <section className="table-card">
        <table>
          <thead>
            <tr>
              <th>
                <button type="button" className="sort-btn" onClick={() => handleSort("name")}>
                  Name <span>{getSortIndicator("name")}</span>
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => handleSort("branch")}>
                  Branch <span>{getSortIndicator("branch")}</span>
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="sort-btn"
                  onClick={() => handleSort("buildTime")}
                >
                  Build Time <span>{getSortIndicator("buildTime")}</span>
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="sort-btn"
                  onClick={() => handleSort("builder")}
                >
                  Build Made By <span>{getSortIndicator("builder")}</span>
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="sort-btn"
                  onClick={() => handleSort("endpoints")}
                >
                  API URLs <span>{getSortIndicator("endpoints")}</span>
                </button>
              </th>
              <th>
                <button type="button" className="sort-btn" onClick={() => handleSort("status")}>
                  Status <span>{getSortIndicator("status")}</span>
                </button>
              </th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.name}>
                <td data-label="Name">{row.name}</td>
                <td data-label="Branch">{row.branch}</td>
                <td data-label="Build Time">{formatTimestamp(row.buildTime)}</td>
                <td data-label="Build Made By">
                  <div className="builder-cell">
                    {row.gitUserPhotoUrl ? (
                      <img
                        src={row.gitUserPhotoUrl}
                        alt={getBuilderName(row)}
                        className="avatar"
                      />
                    ) : (
                      <div className="avatar fallback">?</div>
                    )}

                    <span>{getBuilderName(row)}</span>

                    <button
                      type="button"
                      className="info-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltipRow((current) =>
                          current === row.name ? "" : row.name,
                        );
                      }}
                    >
                      i
                    </button>

                    {activeTooltipRow === row.name ? (
                      <div
                        className="tooltip-card"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p>
                          <strong>Username:</strong> {row.gitUser || "N/A"}
                        </p>
                        <p>
                          <strong>Email:</strong> {row.gitEmail || "N/A"}
                        </p>
                        <button
                          type="button"
                          className="copy-btn"
                          onClick={() => copyBuilderDetails(row)}
                        >
                          {copiedRow === row.name ? "Copied" : "Copy details"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </td>
                <td data-label="API URLs">
                  <div className="api-urls-cell">
                    <div className="api-url-row">
                      <span className="api-url-label">API:</span>
                      {row.apiUrl && row.apiUrl !== "N/A" ? (
                        <a
                          href={row.apiUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="endpoint-link"
                          title={row.apiUrl}
                        >
                          {row.apiUrl}
                        </a>
                      ) : (
                        <span>N/A</span>
                      )}
                    </div>
                    <div className="api-url-row">
                      <span className="api-url-label">PF:</span>
                      {row.pfApiUrl && row.pfApiUrl !== "N/A" ? (
                        <a
                          href={row.pfApiUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="endpoint-link"
                          title={row.pfApiUrl}
                        >
                          {row.pfApiUrl}
                        </a>
                      ) : (
                        <span>N/A</span>
                      )}
                    </div>
                  </div>
                </td>
                <td data-label="Status">
                  {row.status === "online" ? (
                    <span className="status online">🟢 Online</span>
                  ) : (
                    <span className="status offline">🔴 Offline</span>
                  )}
                </td>
                <td data-label="Open">
                  <a
                    href={row.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="open-btn"
                  >
                    Open
                  </a>
                </td>
              </tr>
            ))}
            {showInitialLoader ? (
              <tr className="table-message-row">
                <td colSpan={7} className="loading-row">
                  Loading deployments...
                </td>
              </tr>
            ) : null}
            {showNoResults ? (
              <tr className="table-message-row">
                <td colSpan={7} className="no-results">
                  No matching deployments found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}

export default App;
