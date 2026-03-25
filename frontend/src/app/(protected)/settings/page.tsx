import { Card, CardBody, CardHeader } from "@nextui-org/react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Card className="border border-[#2e2250] bg-[#120c20] text-white">
        <CardHeader>
          <h2 className="text-xl font-bold">Configurações</h2>
        </CardHeader>
        <CardBody>
          <p className="text-violet-200">
            Configurações do sistema em desenvolvimento.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
