/**
 * Seed the database with FICTIONAL demonstration data.
 *
 * ⚠️  Every record created by this script is invented. The incidents,
 *     people, resources, and locations below do not describe real events,
 *     real organisations, or real people. They exist so the dashboard has
 *     something to display during development and demos.
 *
 * Run with:  npm run seed:demo
 *
 * The script is destructive by default — it clears the incidents, resources,
 *     assignments, notifications, and audit logs before inserting the demo set.
 * Pass --keep to leave existing operational records in place.
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { logger } from "../utils/logger.js";
import User, { IUserDocument } from "../models/User.js";
import Incident, { IIncidentDocument } from "../models/Incident.js";
import Resource, { IResourceDocument } from "../models/Resource.js";
import Assignment from "../models/Assignment.js";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import {
  IncidentCategory,
  IncidentStatus,
  ResourceStatus,
  Severity,
  UserRole,
} from "../types/models.js";

/** Marked on every seeded record so demo data can be identified and removed. */
const DEMO_TAG = "fictional-demo-data";

const DEMO_PASSWORD = "RescueGrid2026";

/** GeoJSON point in [longitude, latitude] order, as the schemas expect. */
const point = (
  longitude: number,
  latitude: number
): { type: "Point"; coordinates: [number, number] } => ({
  type: "Point",
  coordinates: [longitude, latitude],
});

interface DemoUser {
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  isAvailable: boolean;
}

const users: DemoUser[] = [
  {
    name: "Ada Okonkwo (fictional)",
    email: "admin@demo.rescuegrid.invalid",
    role: "ADMIN",
    phone: "+1-555-0100",
    isAvailable: true,
  },
  {
    name: "Rohan Mehta (fictional)",
    email: "coordinator@demo.rescuegrid.invalid",
    role: "COORDINATOR",
    phone: "+1-555-0101",
    isAvailable: true,
  },
  {
    name: "Lena Fischer (fictional)",
    email: "responder1@demo.rescuegrid.invalid",
    role: "RESPONDER",
    phone: "+1-555-0102",
    isAvailable: true,
  },
  {
    name: "Marcus Bell (fictional)",
    email: "responder2@demo.rescuegrid.invalid",
    role: "RESPONDER",
    phone: "+1-555-0103",
    isAvailable: true,
  },
  {
    name: "Yuki Tanaka (fictional)",
    email: "responder3@demo.rescuegrid.invalid",
    role: "RESPONDER",
    phone: "+1-555-0104",
    isAvailable: false,
  },
  {
    name: "Priya Raman (fictional)",
    email: "viewer@demo.rescuegrid.invalid",
    role: "VIEWER",
    phone: "+1-555-0105",
    isAvailable: true,
  },
];

interface DemoIncident {
  title: string;
  description: string;
  severity: Severity;
  category: IncidentCategory;
  status: IncidentStatus;
  priority: number;
  location: { type: "Point"; coordinates: [number, number] };
  address: string;
  tags: string[];
}

const incidents: DemoIncident[] = [
  {
    title: "[DEMO] Flash flood across Riverside Drive",
    description:
      "FICTIONAL DEMO INCIDENT. Water levels are rising across the low-lying section of Riverside Drive. Two vehicles are reported stranded and residents in the adjacent blocks have been asked to move to higher ground.",
    severity: Severity.HIGH,
    category: IncidentCategory.FLOOD,
    status: IncidentStatus.ACTIVE,
    priority: 8,
    location: point(-122.3912, 37.7946),
    address: "Riverside Drive (fictional location)",
    tags: ["flood", "residential", DEMO_TAG],
  },
  {
    title: "[DEMO] Warehouse fire in the Docklands",
    description:
      "FICTIONAL DEMO INCIDENT. Smoke is reported from the north warehouse roof. Fire crews have been staged at the loading bay and the adjacent block is being kept clear.",
    severity: Severity.MEDIUM,
    category: IncidentCategory.FIRE,
    status: IncidentStatus.VERIFIED,
    priority: 6,
    location: point(-122.3471, 37.7819),
    address: "Docklands warehouse row (fictional location)",
    tags: ["fire", "industrial", DEMO_TAG],
  },
  {
    title: "[DEMO] Medical emergency at transit interchange",
    description:
      "FICTIONAL DEMO INCIDENT. A passenger collapsed in the interchange concourse. Paramedic response requested and the area around the ticket hall is being kept clear.",
    severity: Severity.CRITICAL,
    category: IncidentCategory.MEDICAL,
    status: IncidentStatus.REPORTED,
    priority: 9,
    location: point(-122.4194, 37.7749),
    address: "Central transit interchange (fictional location)",
    tags: ["medical", "transit", DEMO_TAG],
  },
  {
    title: "[DEMO] Landslip on the northern hillside road",
    description:
      "FICTIONAL DEMO INCIDENT. A section of the northern hillside road has slipped. The road is closed to through traffic and a geotechnical assessment is required before it reopens.",
    severity: Severity.HIGH,
    category: IncidentCategory.LANDSLIDE,
    status: IncidentStatus.RESOLVED,
    priority: 7,
    location: point(-122.4455, 37.8092),
    address: "Northern hillside road (fictional location)",
    tags: ["landslide", "road", DEMO_TAG],
  },
  {
    title: "[DEMO] Seismic activity detected offshore",
    description:
      "FICTIONAL DEMO INCIDENT. Seismic sensors recorded activity offshore. No damage has been reported and the incident is being monitored from the coordination centre.",
    severity: Severity.LOW,
    category: IncidentCategory.EARTHQUAKE,
    status: IncidentStatus.CLOSED,
    priority: 3,
    location: point(-122.5021, 37.7534),
    address: "Offshore monitoring point (fictional location)",
    tags: ["earthquake", "monitoring", DEMO_TAG],
  },
  {
    title: "[DEMO] Gas leak reported at a suburban depot",
    description:
      "FICTIONAL DEMO INCIDENT. A strong smell of gas was reported at a suburban depot. The area has been cordoned off and the utility provider has been notified.",
    severity: Severity.MEDIUM,
    category: IncidentCategory.OTHER,
    status: IncidentStatus.CLOSED,
    priority: 4,
    location: point(-122.3005, 37.8211),
    address: "Suburban depot (fictional location)",
    tags: ["hazmat", "utility", DEMO_TAG],
  },
];

interface DemoResource {
  name: string;
  type: string;
  category: string;
  status: ResourceStatus;
  capacity: number;
  contact: string;
  location: { type: "Point"; coordinates: [number, number] };
}

const resources: DemoResource[] = [
  {
    name: "[DEMO] Rescue boat 1",
    type: "Water rescue unit",
    category: "Rescue",
    status: ResourceStatus.ON_MISSION,
    capacity: 6,
    contact: "rescue1@demo.rescuegrid.invalid",
    location: point(-122.3891, 37.7928),
  },
  {
    name: "[DEMO] High-clearance truck 2",
    type: "Vehicle",
    category: "Transport",
    status: ResourceStatus.AVAILABLE,
    capacity: 8,
    contact: "logistics@demo.rescuegrid.invalid",
    location: point(-122.4103, 37.7702),
  },
  {
    name: "[DEMO] Medical tent (overflow)",
    type: "Medical",
    category: "Medical",
    status: ResourceStatus.AVAILABLE,
    capacity: 20,
    contact: "medical@demo.rescuegrid.invalid",
    location: point(-122.4155, 37.7789),
  },
  {
    name: "[DEMO] Pump unit A",
    type: "Pumping equipment",
    category: "Equipment",
    status: ResourceStatus.MAINTENANCE,
    capacity: 2,
    contact: "maintenance@demo.rescuegrid.invalid",
    location: point(-122.3688, 37.7563),
  },
  {
    name: "[DEMO] Drone survey kit",
    type: "Aerial survey",
    category: "Equipment",
    status: ResourceStatus.AVAILABLE,
    capacity: 2,
    contact: "aerial@demo.rescuegrid.invalid",
    location: point(-122.4321, 37.7866),
  },
  {
    name: "[DEMO] Support vehicle 5",
    type: "Vehicle",
    category: "Transport",
    status: ResourceStatus.UNAVAILABLE,
    capacity: 4,
    contact: "logistics@demo.rescuegrid.invalid",
    location: point(-122.3601, 37.7995),
  },
];

const seed = async (): Promise<void> => {
  const keepExisting = process.argv.includes("--keep");

  await connectDatabase();

  if (!keepExisting) {
    logger.info(
      "Clearing existing operational data (pass --keep to skip this step)"
    );
    await Promise.all([
      Incident.deleteMany({}),
      Resource.deleteMany({}),
      Assignment.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
  }

  // Create (or reuse) the demo accounts.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const createdUsers: IUserDocument[] = [];

  for (const user of users) {
    const existing = await User.findOne({ email: user.email });
    if (existing) {
      createdUsers.push(existing);
      continue;
    }
    const created = await User.create({ ...user, password: passwordHash });
    createdUsers.push(created);
  }

  const byRole = (role: UserRole): IUserDocument => {
    const match = createdUsers.find((user) => user.role === role);
    if (!match) {
      throw new Error(`Demo seed is missing a ${role} account`);
    }
    return match;
  };

  const admin = byRole("ADMIN");
  const coordinator = byRole("COORDINATOR");
  const viewer = byRole("VIEWER");
  const responders = createdUsers.filter((user) => user.role === "RESPONDER");
  const responderOne = responders[0];
  const responderTwo = responders[1];

  const createdIncidents: IIncidentDocument[] = [];
  for (const [index, incident] of incidents.entries()) {
    const reporter = index % 2 === 0 ? viewer : coordinator;
    const created = await Incident.create({
      ...incident,
      reportedBy: reporter._id,
      version: 1,
      auditLog: [
        {
          action: "INCIDENT_CREATED",
          actorId: reporter._id.toString(),
          actorRole: reporter.role,
          timestamp: new Date(
            Date.now() - (incidents.length - index) * 36e5 * 6
          ),
          details: {
            note: "Fictional demonstration record created by the seed script.",
            tag: DEMO_TAG,
          },
        },
      ],
    });
    createdIncidents.push(created);
  }

  const createdResources: IResourceDocument[] = [];
  for (const resource of resources) {
    const created = await Resource.create(resource);
    createdResources.push(created);
  }

  // A couple of dispatches so the assignment views are not empty.
  await Assignment.create([
    {
      incidentId: createdIncidents[0]._id,
      responderId: responderOne._id,
      resourceId: createdResources[0]._id,
      status: "DISPATCHED",
      notes: "Fictional demo dispatch.",
      assignedAt: new Date(Date.now() - 2 * 36e5),
    },
    {
      incidentId: createdIncidents[2]._id,
      responderId: responderTwo._id,
      resourceId: createdResources[2]._id,
      status: "PENDING",
      notes: "Fictional demo dispatch awaiting acknowledgement.",
      assignedAt: new Date(Date.now() - 1 * 36e5),
    },
  ]);

  await Notification.create([
    {
      userId: coordinator._id,
      type: "INCIDENT",
      title: "[DEMO] New critical incident reported",
      message:
        "FICTIONAL DEMO NOTIFICATION. A critical medical incident was reported in the demo dataset.",
      relatedId: createdIncidents[2]._id.toString(),
      isRead: false,
    },
    {
      userId: responderOne._id,
      type: "ASSIGNMENT",
      title: "[DEMO] You have been dispatched",
      message:
        "FICTIONAL DEMO NOTIFICATION. You were dispatched to a fictional flood incident.",
      relatedId: createdIncidents[0]._id.toString(),
      isRead: false,
    },
    {
      userId: admin._id,
      type: "BROADCAST",
      title: "[DEMO] Demo dataset loaded",
      message:
        "FICTIONAL DEMO NOTIFICATION. The demonstration dataset has been loaded for local development.",
      isRead: true,
    },
  ]);

  await AuditLog.create({
    action: "DEMO_DATA_SEEDED",
    entity: "SYSTEM",
    entityId: DEMO_TAG,
    actorId: admin._id.toString(),
    actorRole: "ADMIN",
    details: {
      note: "Fictional demonstration data loaded by the seed script.",
      incidents: createdIncidents.length,
      resources: createdResources.length,
    },
  });

  logger.info("──────────────────────────────────────────────");
  logger.info("FICTIONAL DEMO DATA LOADED — NOT REAL WORLD DATA");
  logger.info("──────────────────────────────────────────────");
  logger.info(`Users:      ${createdUsers.length}`);
  logger.info(`Incidents:  ${createdIncidents.length}`);
  logger.info(`Resources:  ${createdResources.length}`);
  logger.info("Sign in with any of:");
  for (const user of users) {
    logger.info(
      `  ${user.role.padEnd(11)} ${user.email}  /  ${DEMO_PASSWORD}`
    );
  }
  logger.info("──────────────────────────────────────────────");

  await disconnectDatabase();
};

seed()
  .then(() => process.exit(0))
  .catch(async (error) => {
    logger.error("Demo seed failed:", error as Error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
