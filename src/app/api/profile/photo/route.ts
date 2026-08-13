export async function POST(request: Request) {
  const formData = await request.formData();
  const photo = formData.get("photo");
  const name = stringValue(formData.get("name"));
  const username = stringValue(formData.get("username"));

  if (!name || !username) {
    return Response.json({ error: "Name and username are required." }, { status: 400 });
  }

  if (photo instanceof File && photo.size > 0 && !photo.type.startsWith("image/")) {
    return Response.json({ error: "Profile photo must be an image." }, { status: 400 });
  }

  return Response.json({
    profilePhoto:
      photo instanceof File && photo.size > 0
        ? {
            name: photo.name,
            type: photo.type,
            size: photo.size,
          }
        : null,
    profile: {
      name,
      username,
      instagram: stringValue(formData.get("instagram")),
      twitter: stringValue(formData.get("twitter")),
      description: stringValue(formData.get("description")),
      birthday: stringValue(formData.get("birthday")),
      joinDate: stringValue(formData.get("joinDate")),
    },
  });
}

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}
