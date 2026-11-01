# Firebase Integration Code Guide (Get Started & Success Command)

এই গাইডে রয়েছে আপনার হোস্ট অ্যাপ/ডাটাবেজ সার্ভারের জন্য **Get Started বাটন লিসেন করা** এবং **Success বাটন দিয়ে হোয়াটসঅ্যাপ লিংক ট্রিগার করার** সম্পূর্ণ রেডিমেড কোড।

---

## ১. ডাটাবেজ ইনফরমেশন (Firebase Database Info)
- **Database URL**: `https://my-sc-tools-default-rtdb.firebaseio.com`
- **ট্রিগার নোড (Trigger Node)**: `screen_share/trigger`
- **সাকসেস নোড (Success Node)**: `screen_share/status` (অথবা `screen_share/success`)
- **টার্গেট হোয়াটসঅ্যাপ লিংক**: `https://wa.me/message/WYJI35AQB2YHA1`

---

## ২. জাভাস্ক্রিপ্ট / ওয়েব / Node.js কোড (JavaScript / Web / Node.js)

আপনার ডাটাবেজ বা কন্ট্রোল প্যানেলের স্ক্রিপ্টে নিচের কোডটি যুক্ত করুন:

```javascript
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

const firebaseConfig = {
  databaseURL: 'https://my-sc-tools-default-rtdb.firebaseio.com',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ====================================================================
// ১. ওয়েবসাইটে "Get Started" বাটনে ক্লিক হলে তা ডাটাবেজে রিসিভ করার কোড:
// ====================================================================
const triggerRef = ref(db, 'screen_share/trigger');

onValue(triggerRef, (snapshot) => {
  const data = snapshot.val();
  if (data && data.action === 'get_started') {
    console.log('🔔 ওয়েবসাইটে Get Started বাটনে ক্লিক করা হয়েছে!', data);
    
    // 👉 আপনার ডাটাবেজের "Get Started" বাটনটির ক্লিক ফাংশনটি এখানে কল করুন:
    // উদাহরণ: handleGetStartedClick(); অথবা startScreenShare();
  }
});

// ====================================================================
// ২. ডাটাবেজে "Success" বাটন চাপলে ওয়েবসাইটে হোয়াটসঅ্যাপ খোলার কোড:
// ====================================================================
function sendSuccessCommand() {
  const successRef = ref(db, 'screen_share/status');
  
  set(successRef, {
    status: 'success',
    command: 'success',
    action: 'redirect_whatsapp',
    timestamp: Date.now()
  }).then(() => {
    console.log('✅ Success কমান্ড পাঠানো হয়েছে! ওয়েবসাইট এখন হোয়াটসঅ্যাপ লিংক ওপেন করবে।');
  }).catch((err) => {
    console.error('❌ এরর:', err);
  });
}

// 👉 আপনার ডাটাবেজের Success বাটনে এটি যুক্ত করুন:
// document.getElementById('successBtn').addEventListener('click', sendSuccessCommand);
```

---

## ৩. অ্যান্ড্রয়েড (Android / Kotlin) কোড

আপনার অ্যান্ড্রয়েড অ্যাপে `Get Started` ইভেন্ট ধরা এবং `Success` বাটন চাপার কোড:

```kotlin
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError

val database = FirebaseDatabase.getInstance("https://my-sc-tools-default-rtdb.firebaseio.com")

// ১. ওয়েবসাইটে "Get Started" ক্লিক হলে অ্যান্ড্রয়েডে শনাক্ত করা:
val triggerRef = database.getReference("screen_share/trigger")
triggerRef.addValueEventListener(object : ValueEventListener {
    override fun onDataChange(snapshot: DataSnapshot) {
        val action = snapshot.child("action").getValue(String::class.java)
        if (action == "get_started") {
            // 👉 আপনার অ্যান্ড্রয়েড অ্যাপের Get Started বাটনটি ক্লিক করুন বা স্ক্রিন শেয়ার শুরু করুন:
            btnGetStarted.performClick()
        }
    }
    override fun onCancelled(error: DatabaseError) {}
})

// ২. অ্যান্ড্রয়েড অ্যাপের "Success" বাটনে ক্লিক করলে ফায়ারবেসে সিগন্যাল পাঠানো:
btnSuccess.setOnClickListener {
    val successMap = hashMapOf<String, Any>(
        "status" to "success",
        "command" to "success",
        "timestamp" to System.currentTimeMillis()
    )
    database.getReference("screen_share/status").setValue(successMap)
        .addOnSuccessListener {
            // সফলভাবে পাঠানো হয়েছে
        }
}
```

---

## ৪. অ্যান্ড্রয়েড (Android / Java) কোড

```java
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import java.util.HashMap;

FirebaseDatabase database = FirebaseDatabase.getInstance("https://my-sc-tools-default-rtdb.firebaseio.com");

// ১. Get Started লিসেন করা:
DatabaseReference triggerRef = database.getReference("screen_share/trigger");
triggerRef.addValueEventListener(new ValueEventListener() {
    @Override
    public void onDataChange(DataSnapshot snapshot) {
        if (snapshot.hasChild("action")) {
            String action = snapshot.child("action").getValue(String.class);
            if ("get_started".equals(action)) {
                // 👉 আপনার অ্যাপের Get Started বাটনে ক্লিক ট্রিগার:
                btnGetStarted.performClick();
            }
        }
    }
    @Override
    public void onCancelled(DatabaseError error) {}
});

// ২. Success বাটন ক্লিক করে সিগন্যাল পাঠানো:
btnSuccess.setOnClickListener(v -> {
    HashMap<String, Object> map = new HashMap<>();
    map.put("status", "success");
    map.put("command", "success");
    map.put("timestamp", System.currentTimeMillis());
    database.getReference("screen_share/status").setValue(map);
});
```

---

## ৫. সরাসরি ফায়ারবেস কনসোল বা ব্রাউজার থেকে টেস্ট করার পদ্ধতি (Quick Test)

আপনি যদি সরাসরি ব্রাউজার বা টার্মিনাল (CURL) থেকে টেস্ট করতে চান:

**সাকসেস কমান্ড পাঠানোর CURL কমান্ড:**
```bash
curl -X PUT -d '{"status":"success","command":"success","timestamp":1793145000000}' https://my-sc-tools-default-rtdb.firebaseio.com/screen_share/status.json
```
এই কমান্ডটি চালানো মাত্রই ওয়েবসাইটে কনফেটি উড়ে উঠবে এবং স্বয়ংক্রিয়ভাবে `https://wa.me/message/WYJI35AQB2YHA1` ওপেন হয়ে যাবে!
