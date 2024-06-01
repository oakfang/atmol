import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { cleanup } from "@testing-library/react";
import { afterEach } from "bun:test";

GlobalRegistrator.register();

afterEach(cleanup);
