import { ButtonLink } from "../components/common/Button";

const NotFound = () => {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-alert-red/50 bg-alert-red/10 text-alert-red shadow-neon-red mb-4">
        <span className="font-mono text-xl font-black">404</span>
      </div>
      <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-alert-red">
        SIGNAL LOST // SECTOR UNKNOWN
      </p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
        Tactical Sector Not Found
      </h1>
      <p className="mt-2 max-w-md font-mono text-sm text-platinum-700">
        The route or tactical grid coordinate you requested does not exist or has been secured.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/dashboard">Return to Command Center</ButtonLink>
        <ButtonLink to="/map" variant="secondary">
          Open tactical map
        </ButtonLink>
      </div>
    </div>
  );
};

export default NotFound;
