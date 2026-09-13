import ComputerGate from '@/components/ComputerGate';
import Terminal from '@/components/Terminal';
import { splash } from '@/src/content';

export default function Page() {
  return (
    <ComputerGate>
      <Terminal splash={splash} />
    </ComputerGate>
  );
}
