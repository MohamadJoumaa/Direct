import { HomeHeader, HomeHero, HomeMarketing } from "./home-interactive";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <HomeHeader />
      <HomeHero />
      <HomeMarketing />
    </div>
  );
}
