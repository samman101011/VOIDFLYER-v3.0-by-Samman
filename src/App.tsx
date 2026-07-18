/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpaceGame } from "./components/SpaceGame";

export default function App() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-neutral-950 text-white select-none">
      <SpaceGame />
    </main>
  );
}

