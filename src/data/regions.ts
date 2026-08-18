/**
 * Region list for the global location control (G-5).
 *
 * Order matters and is specified: CITIES first, STATES second. A client who
 * lives in a metro picks their city; everyone else falls back to a state so
 * the platform still knows roughly where they are.
 */

export const REGION_CITIES = [
  "Chennai",
  "Bengaluru",
  "Hyderabad",
  "Mumbai",
  "Delhi NCR",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Kochi",
  "Coimbatore",
  "Madurai",
  "Vizag",
];

export const REGION_STATES = [
  "Tamil Nadu",
  "Karnataka",
  "Kerala",
  "Telangana",
  "Andhra Pradesh",
  "Maharashtra",
  "Gujarat",
  "Delhi",
  "Uttar Pradesh",
  "West Bengal",
  "Rajasthan",
  "Punjab",
  "Madhya Pradesh",
  "Odisha",
  "Bihar",
  "Assam",
  "Goa",
  "Chandigarh",
];
