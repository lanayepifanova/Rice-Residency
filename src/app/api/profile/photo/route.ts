export async function POST(request: Request) {
  const formData = await request.formData();
  const photo = formData.get("photo");

  if (!(photo instanceof File)) {
    return Response.json({ error: "Photo is required." }, { status: 400 });
  }

  if (!photo.type.startsWith("image/")) {
    return Response.json({ error: "Profile photo must be an image." }, { status: 400 });
  }

  return Response.json({
    profilePhoto: {
      name: photo.name,
      type: photo.type,
      size: photo.size,
    },
  });
}
