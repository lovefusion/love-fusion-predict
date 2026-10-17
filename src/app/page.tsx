import { redirect } from "next/navigation";

// Root redirect → public prediction entry
export default function HomePage() {
  redirect("/predict");
}
