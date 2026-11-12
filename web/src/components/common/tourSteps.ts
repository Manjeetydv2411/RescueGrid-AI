export interface TourStep {
  target: string;
  title: string;
  content: string;
  route?: string;
}

export interface TourDefinition {
  id: string;
  title: string;
  description: string;
  minRole?: "VIEWER" | "RESPONDER" | "COORDINATOR" | "ADMIN";
  steps: TourStep[];
}

export const TOURS: TourDefinition[] = [
  {
    id: "platform-intro",
    title: "First-Time Platform Tour",
    description: "Discover RescueGrid's core operational capabilities, navigation, and live telemetry.",
    steps: [
      {
        target: '[data-tour="sidebar-dashboard"]',
        title: "Command Center Dashboard",
        content: "Monitor high-level emergency metrics, active incidents summary, and system health status at a glance.",
        route: "/dashboard",
      },
      {
        target: '[data-tour="tactical-map"]',
        title: "Live Tactical Map",
        content: "Track real-time incident and resource geospatial positions, severity heatmaps, and toggle radar sweeps.",
        route: "/map",
      },
      {
        target: '[data-tour="sidebar-incidents"]',
        title: "Incidents & SOS Management",
        content: "Review incoming emergency reports, filter by severity and category, and inspect detailed timelines.",
        route: "/incidents",
      },
      {
        target: '[data-tour="sidebar-resources"]',
        title: "Resource Fleet Inventory",
        content: "Track available equipment, medical units, rescue boats, and vehicles with address geocoding.",
        route: "/resources",
      },
      {
        target: '[data-tour="broadcast-action"]',
        title: "Emergency Broadcasts",
        content: "Compose and dispatch multi-channel alerts (SMS, Email, Push) to responders and regional citizens.",
        route: "/broadcasts",
      },
    ],
  },
  {
    id: "resource-management",
    title: "Resource & Location Picker Tour",
    description: "Learn how to register assets, search addresses using OpenStreetMap Nominatim, and adjust map markers.",
    minRole: "COORDINATOR",
    steps: [
      {
        target: '[data-tour="sidebar-resources"]',
        title: "Accessing Resource Inventory",
        content: "Navigate to the Resource Fleet inventory to view, filter, and manage all response assets.",
        route: "/resources",
      },
      {
        target: '[data-tour="resource-add"]',
        title: "Adding New Assets",
        content: "Click 'Add Resource' to open the registration form for vehicles, equipment, or personnel pools.",
        route: "/resources",
      },
      {
        target: '[data-tour="resource-location-picker"]',
        title: "Address Search & Location Picker",
        content: "Enter a normal address, landmark, or city name. Click Search to resolve coordinates via OpenStreetMap Nominatim without manual lat/lng entry.",
        route: "/resources",
      },
    ],
  },
  {
    id: "incident-management",
    title: "Incident Management Tour",
    description: "Master emergency reporting, filtering, tracking, and operational dispatch.",
    steps: [
      {
        target: '[data-tour="sidebar-incidents"]',
        title: "Incident Queue",
        content: "Inspect all active emergency reports, severity indicators, and categories in real-time.",
        route: "/incidents",
      },
      {
        target: '[data-tour="incident-actions"]',
        title: "Reporting Emergencies",
        content: "Use the report form to log new emergency situations, specifying severity, category, and precise address locations.",
        route: "/incidents",
      },
    ],
  },
  {
    id: "responder-mission",
    title: "Responder & Unit Dispatches Tour",
    description: "Learn how responders view assigned missions and update mission availability.",
    minRole: "RESPONDER",
    steps: [
      {
        target: '[data-tour="assignment-list"]',
        title: "Unit Dispatches & Assignments",
        content: "View active incident dispatches assigned to your responder unit and track mission status changes.",
        route: "/assignments",
      },
    ],
  },
];
