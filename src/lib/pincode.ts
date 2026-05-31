/**
 * List of Indian States and Union Territories.
 */
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry"
];

interface PincodePostOffice {
  Name: string;
  Description: string | null;
  BranchType: string;
  DeliveryStatus: string;
  Circle: string;
  District: string;
  Division: string;
  Region: string;
  State: string;
  Country: string;
  Pincode: string;
}

interface PincodeApiResponse {
  Message: string;
  Status: "Success" | "Error";
  PostOffice: PincodePostOffice[] | null;
}

function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Fetches district and state information for a given Indian pincode.
 * Returns null if the pincode is invalid or not found.
 */
export async function fetchDistrictAndStateFromPincode(
  pincode: string
): Promise<{ district: string; state: string } | null> {
  const cleanPincode = pincode.replace(/\D/g, "");
  if (cleanPincode.length !== 6) {
    return null;
  }

  // 1. Try static GitHub Pages API first (highly reliable SSL, static caching)
  try {
    const res = await fetch(`https://aniket-thapa.github.io/india-pincode-api/pincodes/${cleanPincode}.json`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.state && data.district) {
        return {
          district: toTitleCase(data.district),
          state: toTitleCase(data.state),
        };
      }
    }
  } catch (error) {
    console.warn("Failed to fetch from static pincode API, trying fallback...", error);
  }

  // 2. Fallback to Postal Pincode API (may have SSL/certificate issues on some networks)
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPincode}`);
    if (res.ok) {
      const data = (await res.json()) as PincodeApiResponse[];
      if (
        data &&
        data[0] &&
        data[0].Status === "Success" &&
        data[0].PostOffice &&
        data[0].PostOffice.length > 0
      ) {
        const postOffice = data[0].PostOffice[0];
        return {
          district: toTitleCase(postOffice.District || postOffice.Division || postOffice.Block || ""),
          state: toTitleCase(postOffice.State || ""),
        };
      }
    }
  } catch (error) {
    console.error("Error in fallback pincode API:", error);
  }

  return null;
}
