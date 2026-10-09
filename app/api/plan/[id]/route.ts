import { z } from "zod";
import { deletePlan, isOwner, loadPlan } from "@/lib/plans";

const DeleteRequest = z.object({ ownerKey: z.string().max(100) });

type Context = { params: Promise<{ id: string }> };

// Deletes a plan for everyone. Only the device that made it has the key.
export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = DeleteRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "That didn't come through. Please try again." }, { status: 400 });
  }
  const stored = await loadPlan(id);
  // Already gone, maybe deleted on another tab.
  if (!stored) return Response.json({ ok: true });
  if (!isOwner(stored, parsed.data.ownerKey)) {
    return Response.json({ error: "Only the device that made this plan can delete it." }, { status: 403 });
  }
  try {
    await deletePlan(id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Deleting plan failed:", error);
    return Response.json({ error: "We couldn't delete the plan. Please try again." }, { status: 502 });
  }
}
