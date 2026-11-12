import { logger } from "../utils/logger.js";

export interface AssistantUserContext {
  id: string;
  name: string;
  email: string;
  role: "VIEWER" | "RESPONDER" | "COORDINATOR" | "ADMIN" | string;
}

export class AssistantService {
  async generateResponse(message: string, user: AssistantUserContext): Promise<{ response: string; role: string }> {
    const q = message.toLowerCase();
    const role = user.role;

    logger.info(`Assistant query from user ${user.id} (${role}): "${message}"`);

    let roleAdvice = "";
    if (role === "VIEWER") {
      roleAdvice = "Note: As a Viewer, your account has read-only access to view incidents, resources, the tactical map, and notifications.";
    } else if (role === "RESPONDER") {
      roleAdvice = "Note: As a Responder, you can view your assigned missions and update your mission status.";
    } else if (role === "COORDINATOR") {
      roleAdvice = "Note: As a Coordinator, you can create and edit incidents and resources, dispatch response units, and send emergency broadcasts.";
    } else if (role === "ADMIN") {
      roleAdvice = "Note: As an Administrator, you have full access to user management, audit logs, system configuration, and all coordinator/responder features.";
    }

    if (q.includes("location") || q.includes("picker") || q.includes("address") || q.includes("nominatim") || q.includes("map marker")) {
      return {
        response: `**Resource Location Picker Guide:**\n\nWhen adding or editing a resource in the Resource Inventory, you can enter a normal address, locality, landmark, or facility name instead of manual coordinates.\n- **Search:** Type an address and click **Search** (powered by OpenStreetMap Nominatim) to find matching locations.\n- **Map Preview:** View the location on the interactive map preview.\n- **Adjust:** Click anywhere on the map or drag the marker to fine-tune the exact position.\n- **Read-Only Info:** The resolved address and coordinates are automatically populated.\n\n${roleAdvice}`,
        role,
      };
    }

    if (q.includes("incident") || q.includes("report") || q.includes("severity") || q.includes("category")) {
      if (role === "VIEWER") {
        return {
          response: `**Incidents (Viewer Access):**\n\nYou can view all active emergency incidents, inspect their severity (Low, Medium, High, Critical), category (Flood, Fire, Earthquake, Landslide, Medical, Other), and location details on the Incidents page and Tactical Map. Creating or modifying incidents requires Coordinator or Admin permissions.\n\n${roleAdvice}`,
          role,
        };
      }
      return {
        response: `**Incident Management:**\n\nYou can report new incidents by clicking **New Incident**, filling out the title, description, category, severity, and using the exact Location Picker for coordinates/address. Coordinators and Admins can also inspect and update incident status and assignments.\n\n${roleAdvice}`,
        role,
      };
    }

    if (q.includes("resource") || q.includes("equipment") || q.includes("vehicle") || q.includes("inventory")) {
      if (role === "VIEWER") {
        return {
          response: `**Resource Inventory (Viewer Access):**\n\nYou can view the status, capacity, category, and location of available equipment, vehicles, and response teams in the Resource Inventory. Adding or editing resources requires Coordinator or Admin privileges.\n\n${roleAdvice}`,
          role,
        };
      }
      return {
        response: `**Resource Management:**\n\nNavigate to **Resources** in the sidebar to view the operational inventory. Click **Add Resource** to register a new asset using the address Location Picker, or click **Edit** on any resource row to update its parameters.\n\n${roleAdvice}`,
        role,
      };
    }

    if (q.includes("map") || q.includes("tactical") || q.includes("radar") || q.includes("filter")) {
      return {
        response: `**Tactical Map & Radar:**\n\nThe Tactical Map provides real-time geospatial awareness of all active incidents and resources:\n- **Radar Overlay:** Toggle the animated radar sweep and range rings.\n- **Filters:** Filter visible markers by incidents, resources, or resource categories.\n- **Popups:** Click any marker to inspect details or select units.\n\n${roleAdvice}`,
        role,
      };
    }

    if (q.includes("broadcast") || q.includes("alert") || q.includes("sms") || q.includes("email")) {
      if (role !== "ADMIN" && role !== "COORDINATOR") {
        return {
          response: `**Emergency Broadcasts:**\n\nEmergency broadcasts allow sending targeted alerts across SMS, Email, Push, or In-App channels. This feature is restricted to Coordinators and Administrators.\n\n${roleAdvice}`,
          role,
        };
      }
      return {
        response: `**Emergency Broadcasts:**\n\nGo to **Broadcasts** to compose and send emergency alerts. You can target recipients by channel (SMS, Email, Push, In-App) and geographic region (District or City address string).\n\n${roleAdvice}`,
        role,
      };
    }

    if (q.includes("role") || q.includes("permission") || q.includes("admin") || q.includes("user")) {
      return {
        response: `**User Roles & Permissions:**\n\nRescueGrid enforces strict role-based access control:\n- **Viewer:** Read-only access to operational data and maps.\n- **Responder:** Mission and assignment updates.\n- **Coordinator:** Full incident, resource, and broadcast management.\n- **Admin:** Complete platform control, user role administration, and audit logs.\n\n${roleAdvice}`,
        role,
      };
    }

    return {
      response: `Hello **${user.name}**! I am your RescueGrid Assistant.\n\nI can help you navigate RescueGrid, explain features like the **Resource Location Picker**, **Tactical Map**, **Incident Management**, and guide you on what actions you can perform under your **${role}** role.\n\n*How can I assist you with your emergency response coordination today?*`,
      role,
    };
  }
}

export const assistantService = new AssistantService();
