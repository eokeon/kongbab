import java.io.BufferedReader;
import java.io.FileReader;
import java.util.regex.*;

public class CheckDefaultAvatars {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new FileReader("docs/streamers.json"));
        String line;
        Pattern pStreamer = Pattern.compile("\"streamer\"\\s*:\\s*\"([^\"]*)\"");
        Pattern pName = Pattern.compile("\"name\"\\s*:\\s*\"([^\"]*)\"");
        Pattern pAvatar = Pattern.compile("\"avatar\"\\s*:\\s*\"([^\"]*)\"");
        Pattern pYt = Pattern.compile("\"youtubeUrl\"\\s*:\\s*\"([^\"]*)\"");

        String currStreamer = "";
        String currName = "";
        String currAvatar = "";
        String currYt = "";

        while ((line = br.readLine()) != null) {
            Matcher ms = pStreamer.matcher(line);
            if (ms.find()) currStreamer = ms.group(1);
            Matcher mn = pName.matcher(line);
            if (mn.find()) currName = mn.group(1);
            Matcher ma = pAvatar.matcher(line);
            if (ma.find()) currAvatar = ma.group(1);
            Matcher my = pYt.matcher(line);
            if (my.find()) {
                currYt = my.group(1);
                if (currAvatar.equals("assets/default-avatar.svg") || currAvatar.isBlank()) {
                    System.out.printf("%s (%s) -> avatar: %s | yt: %s%n", currStreamer, currName, currAvatar, currYt);
                }
            }
        }
        br.close();
    }
}
