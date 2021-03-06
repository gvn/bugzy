import React from "react";
import styles from "./Router.scss";
import { BugListView } from "../BugListView/BugListView";
import {
  BrowserRouter,
  NavLink,
  Redirect,
  Route,
  Switch,
  withRouter,
} from "react-router-dom";
import { columnTransforms as cTrans } from "../BugList/columnTransforms";
import { IterationView } from "../IterationView/IterationView";
import { MyBugs } from "../MyBugs/MyBugs";
import { Preferences } from "../Preferences/Preferences";
// import {ReleaseReport} from "../ReleaseReport/ReleaseReport";
import { FeatureView } from "../FeatureView/FeatureView";
import { OtherView } from "../OtherView/OtherView";
import { Triage } from "../Triage/Triage";
import { Uplift } from "../Uplift/Uplift";
import { Exports } from "../Exports/Exports";
import { FeatureList } from "../FeatureList/FeatureList";
import { ActiveRSMessages } from "../ActiveRSMessages/ActiveRSMessages";
import { PriorityGuide } from "../PriorityGuide/PriorityGuide";
import { ReleaseReport } from "../ReleaseReport/ReleaseReport";
import {
  getAdjacentIteration,
  getIteration,
} from "../../../common/iterationUtils";
import { BUGZILLA_TRIAGE_COMPONENTS } from "../../../config/project_settings";
import { isBugResolved } from "../../lib/utils";

const noFeatureSort = (a, b) => {
  const iteration1 = cTrans.cf_fx_iteration(a.cf_fx_iteration);
  const iteration2 = cTrans.cf_fx_iteration(b.cf_fx_iteration);
  if (iteration1 < iteration2) {
    return -1;
  }
  if (iteration1 > iteration2) {
    return 1;
  }

  if (a.priority < b.priority) {
    return -1;
  }
  if (a.priority > b.priority) {
    return 1;
  }

  return 0;
};

const EXP_META = 1644390;

const RouterNav = withRouter(
  class _RouterNav extends React.PureComponent {
    renderListItem(route, i) {
      return (
        <li key={i}>
          <NavLink
            activeClassName={styles.active}
            className={styles.navLink}
            to={route.routeProps ? route.routeProps.path : route.path}>
            {route.icon ? (
              <span
                className={`${styles.icon} ${styles[`icon-${route.icon}`]}`}
              />
            ) : null}
            <span>{route.label}</span>
          </NavLink>
        </li>
      );
    }

    async refreshMetas() {
      await fetch("/refresh_metas");
      window.location.reload();
    }

    render() {
      const { routes } = this.props;
      return (
        <nav className={styles.aside}>
          <ul>
            {routes
              .filter(route => !route.hidden)
              .map((route, i) => {
                if (route.spacer) {
                  return <li key={i} className={styles.spacer} />;
                } else if (route.header) {
                  return (
                    <li key={i} className={styles.header}>
                      {route.header}
                    </li>
                  );
                }
                return this.renderListItem(route, i);
              })}
            <li>
              <a
                className={styles.navLink}
                href="https://github.com/k88hudson/bugzy/issues">
                <span className={`${styles.icon} ${styles["icon-alert"]}`} />
                Report an issue
              </a>
            </li>
            <li>
              <a className={styles.navLink} onClick={this.refreshMetas} href="">
                Refresh metabugs
              </a>
            </li>
          </ul>
        </nav>
      );
    }
  }
);

export class Router extends React.PureComponent {
  getMetaLinks(component) {
    return (
      this.props.metas
        // Filter out pocket because it gets a special one
        .filter(
          meta =>
            meta.priority === "P1" &&
            meta.component === component &&
            !isBugResolved(meta)
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map(meta => ({
          path: `/feature/${meta.id}`,
          label: meta.displayName,
        }))
    );
  }

  getMetasBySection() {
    const result = { m: [], p: [], x: [] };
    this.props.metas.forEach(meta => {
      if (meta.priority === "P1" && !isBugResolved(meta)) {
        if (meta.blocks.includes(EXP_META)) {
          result.x.push(meta);
        } else if (["New Tab Page", "Pocket"].includes(meta.component)) {
          result.p.push(meta);
        } else if (meta.component === "Messaging System") {
          result.m.push(meta);
        }
      }
    });
    for (const key in result) {
      result[key] = result[key]
        .sort((a, b) => {
          if (a.priority < b.priority) {
            return -1;
          }
          if (a.priority > b.priority) {
            return 1;
          }
          return a.displayName.localeCompare(b.displayName);
        })
        .map(meta => ({
          path: `/feature/${meta.id}`,
          label: `${meta.priority !== "P1" ? `[${meta.priority}] ` : ""}${
            meta.displayName
          }`,
        }));
    }
    return result;
  }

  otherQuery(component) {
    return {
      component,
      resolution: "---",
      rules: [
        {
          key: "blocked",
          operator: "nowordssubstr",
          value: this.props.metas
            .filter(meta => meta.priority === "P1")
            .map(m => m.id),
        },
        { key: "keywords", operator: "nowordssubstr", value: "meta" },
        {
          operator: "OR",
          rules: [
            {
              key: "cf_fx_iteration",
              operator: "notequals",
              value: "---",
            },
            { key: "priority", operator: "equals", value: "P1" },
          ],
        },
      ],
    };
  }

  render() {
    const release = getIteration().number.split(".")[0];
    const prevRelease = release - 1;

    const metasBySection = this.getMetasBySection();

    const ROUTER_CONFIG = [
      {
        label: "Current Iteration",
        exact: false,
        icon: "calendar",
        routeProps: {
          path: "/current_iteration",
          render: props => (
            <IterationView
              {...props}
              metas={this.props.metas}
              iteration={getIteration().number}
            />
          ),
        },
      },
      {
        label: "Next Iteration",
        exact: false,
        icon: "calendar2",
        path: `/iteration/${getAdjacentIteration(1).number}`,
        navOnly: true,
      },
      {
        label: `Uplifts`,
        icon: "up-arrow",
        routeProps: {
          path: "/uplift",
          render: () => <Uplift {...{ release, prevRelease }} />,
        },
      },
      {
        label: "Iteration",
        exact: false,
        routeProps: {
          path: "/iteration/:iteration",
          render: props => (
            <IterationView
              {...props}
              metas={this.props.metas}
              iteration={props.match.params.iteration}
            />
          ),
        },
        hidden: true,
      },
      {
        label: "Triage",
        exact: false,
        icon: "inbox",
        routeProps: {
          path: "/triage",
          render: props => <Triage {...props} metas={this.props.metas} />,
        },
      },
      {
        label: "Release Report",
        exact: false,
        icon: "graph",
        routeProps: {
          path: "/release/:iteration",
          render: props => (
            <ReleaseReport
              {...props}
              metas={this.props.metas}
              iteration={props.match.params.iteration}
            />
          ),
        },
        hidden: true,
      },
      { spacer: true },
      {
        label: "My Bugs",
        icon: "user",
        routeProps: {
          path: "/my_bugs",
          component: MyBugs,
        },
      },
      {
        label: "Regression",
        icon: "warning",
        routeProps: {
          path: "/regression",
          render: () => (
            <BugListView
              title="Regression"
              query={{
                component: BUGZILLA_TRIAGE_COMPONENTS,
                keywords: ["regression"],
                resolution: "---",
                order: "cf_fx_iteration DESC",
              }}
            />
          ),
        },
      },
      {
        label: `Exports`,
        icon: "up-arrow-yellow",
        routeProps: {
          path: "/exports",
          render: () => <Exports {...{ release, prevRelease }} />,
        },
      },
      {
        label: "All Features",
        icon: "balloons",
        routeProps: {
          path: "/feature_list",
          render: () => <FeatureList metas={this.props.metas} />,
        },
      },
      {
        label: "RS Messages",
        icon: "graph",
        routeProps: {
          path: "/rs-messages",
          render: () => <ActiveRSMessages />,
        },
      },
      {
        label: "Feature",
        exact: false,
        routeProps: {
          path: "/feature/:id",
          render: props => <FeatureView {...props} metas={this.props.metas} />,
        },
        hidden: true,
      },
      {
        label: "No Feature",
        hidden: true,
        routeProps: {
          path: "/no-feature",
          render: () => (
            <BugListView
              title="No Feature"
              query={{
                component: BUGZILLA_TRIAGE_COMPONENTS,
                resolution: "---",
                custom: {
                  blocked: { nowordssubstr: this.props.metas.map(m => m.id) },
                  cf_fx_iteration: { notequals: "---" },
                  keywords: { nowordssubstr: "meta" },
                },
              }}
              sort={noFeatureSort}
            />
          ),
        },
      },
      { spacer: true },
      { header: `Firefox ${release} | UJET` },
      ...metasBySection.m,
      // ...this.getMetaLinks("Messaging System"),
      {
        label: "Other...",
        routeProps: {
          path: "/other",
          exact: true,
          render: props => (
            <OtherView
              {...props}
              metas={this.props.metas}
              components={["Messaging System"]}
            />
          ),
        },
      },
      { spacer: true },
      { header: `Firefox ${release} | Nimbus` },
      {
        label: "All Nimbus (X-man)",
        routeProps: {
          path: "/nimbus-desktop",
          exact: true,
          render: () => (
            <BugListView
              title="Nimbus Desktop Client (JS)"
              query={{
                component: ["Nimbus Desktop Client"],
                resolution: "---",
              }}
              sort={noFeatureSort}
            />
          ),
        },
      },
      ...metasBySection.x,
      { spacer: true },
      { header: `Firefox ${release} | New Tab` },
      ...metasBySection.p,
      // ...this.getMetaLinks("New Tab Page"),
      {
        label: "Other...",
        routeProps: {
          path: "/other-pocket",
          exact: true,
          render: props => (
            <OtherView
              {...props}
              metas={this.props.metas}
              components={["New Tab Page", "Pocket"]}
            />
          ),
        },
      },
      { spacer: true },
      {
        label: "About Bugzy",
        icon: "info",
        routeProps: {
          path: "/about",
          component: Preferences,
        },
      },
    ];

    return (
      <BrowserRouter>
        <React.Fragment>
          <RouterNav routes={ROUTER_CONFIG} />
          <main className={styles.main}>
            <Switch>
              <Route exact={true} path="/">
                <Redirect to="/current_iteration" />
              </Route>
              {ROUTER_CONFIG.filter(
                route => route.routeProps && !route.navOnly
              ).map((route, index) => (
                <Route
                  exact={route.exact !== false}
                  key={index}
                  {...route.routeProps}
                />
              ))}
            </Switch>
          </main>
          <PriorityGuide />
        </React.Fragment>
      </BrowserRouter>
    );
  }
}
